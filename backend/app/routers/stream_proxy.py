from __future__ import annotations

import logging
import re
from typing import Optional
from urllib.parse import quote, unquote, urljoin

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

logger = logging.getLogger("cricket_app.stream_proxy")

router = APIRouter(prefix="/proxy", tags=["Stream Proxy"])

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15"
)


def rewrite_m3u8_manifest(content: str, base_url: str, proxy_endpoint: str, referer: Optional[str] = None) -> str:
    """
    Parse .m3u8 playlist lines and rewrite relative & absolute segment/sub-playlist
    URLs so they route back through /api/v1/proxy/hls.
    """
    lines = content.splitlines()
    rewritten_lines = []

    def make_proxy_url(target: str) -> str:
        abs_target = urljoin(base_url, target.strip())
        encoded_url = quote(abs_target, safe="")
        new_url = f"{proxy_endpoint}?url={encoded_url}"
        if referer:
            new_url += f"&referer={quote(referer, safe='')}"
        return new_url

    # Regex to match URI="..." inside tags like #EXT-X-MAP, #EXT-X-KEY, #EXT-X-MEDIA
    uri_tag_pattern = re.compile(r'URI="([^"]+)"')

    for line in lines:
        stripped = line.strip()

        if not stripped:
            rewritten_lines.append(line)
            continue

        if stripped.startswith("#"):
            # Check for URI attributes inside tags like #EXT-X-MAP:URI="..." or #EXT-X-KEY:METHOD=...,URI="..."
            if 'URI="' in stripped:
                def replace_tag_uri(match):
                    original_uri = match.group(1)
                    return f'URI="{make_proxy_url(original_uri)}"'
                rewritten_lines.append(uri_tag_pattern.sub(replace_tag_uri, line))
            else:
                rewritten_lines.append(line)
        else:
            # This is a segment or sub-playlist URL line
            rewritten_lines.append(make_proxy_url(stripped))

    return "\n".join(rewritten_lines)


@router.api_route("/hls", methods=["GET", "HEAD"])
async def proxy_hls_stream(
    request: Request,
    url: str = Query(..., description="Target .m3u8 manifest or .ts/.m4s segment URL"),
    referer: Optional[str] = Query(None, description="Optional Referer header to bypass CDN checks"),
    user_agent: Optional[str] = Query(None, description="Optional User-Agent string"),
):
    """
    Production HLS (.m3u8) & video segment reverse proxy.
    Bypasses CORS restrictions and Referer hotlink protections:
    - Parses and rewrites .m3u8 playlists so nested segments route through proxy.
    - Streams video segments (.ts, .m4s, .aac) with low memory overhead.
    """
    target_url = unquote(url).strip()
    if not target_url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid stream URL protocol. Must be HTTP or HTTPS.")

    req_headers = {
        "User-Agent": user_agent or DEFAULT_USER_AGENT,
        "Accept": "*/*",
    }
    if referer:
        req_headers["Referer"] = referer
        req_headers["Origin"] = referer.split("://")[0] + "://" + referer.split("://")[1].split("/")[0]

    # Forward Range headers if present (needed for fMP4 / byte-range HLS)
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header

    try:
        # Determine whether this is a manifest or a binary segment
        is_manifest = ".m3u8" in target_url.split("?")[0].lower()

        client = httpx.AsyncClient(timeout=20.0, follow_redirects=True)

        if is_manifest:
            if request.method == "HEAD":
                resp = await client.head(target_url, headers=req_headers)
                await client.aclose()
                headers = {
                    "Content-Type": "application/vnd.apple.mpegurl",
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                    "Access-Control-Allow-Headers": "*",
                    "Cache-Control": "no-cache, no-store, must-revalidate",
                }
                return Response(content=b"", media_type="application/vnd.apple.mpegurl", headers=headers, status_code=resp.status_code)

            resp = await client.get(target_url, headers=req_headers)
            if resp.status_code >= 400:
                await client.aclose()
                raise HTTPException(status_code=resp.status_code, detail=f"Upstream stream error: {resp.status_code}")

            content_text = resp.text
            final_url = str(resp.url)
            await client.aclose()

            # Rewrite manifest
            proxy_endpoint = str(request.url.path)
            rewritten = rewrite_m3u8_manifest(
                content=content_text,
                base_url=final_url,
                proxy_endpoint=proxy_endpoint,
                referer=referer,
            )

            headers = {
                "Content-Type": "application/vnd.apple.mpegurl",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "no-cache, no-store, must-revalidate",
            }
            return Response(content=rewritten, media_type="application/vnd.apple.mpegurl", headers=headers)

        else:
            # Binary segment streaming (.ts, .m4s, .aac, .mp4, etc.)
            req = client.build_request(request.method, target_url, headers=req_headers)
            upstream_resp = await client.send(req, stream=True)

            if upstream_resp.status_code >= 400:
                await upstream_resp.aclose()
                await client.aclose()
                raise HTTPException(status_code=upstream_resp.status_code, detail="Segment fetch failed")

            response_headers = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Cache-Control": "public, max-age=3600",
            }

            for h in ["content-type", "content-length", "content-range", "accept-ranges"]:
                if h in upstream_resp.headers:
                    response_headers[h] = upstream_resp.headers[h]

            if request.method == "HEAD":
                await upstream_resp.aclose()
                await client.aclose()
                return Response(
                    content=b"",
                    status_code=upstream_resp.status_code,
                    headers=response_headers,
                    media_type=upstream_resp.headers.get("content-type", "video/MP2T"),
                )

            async def stream_generator():
                try:
                    async for chunk in upstream_resp.aiter_bytes(chunk_size=65536):
                        yield chunk
                finally:
                    await upstream_resp.aclose()
                    await client.aclose()

            return StreamingResponse(
                stream_generator(),
                status_code=upstream_resp.status_code,
                headers=response_headers,
                media_type=upstream_resp.headers.get("content-type", "video/MP2T"),
            )

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"Error proxying stream {target_url}: {exc}", exc_info=True)
        raise HTTPException(status_code=502, detail=f"Stream proxy gateway error: {str(exc)}")
