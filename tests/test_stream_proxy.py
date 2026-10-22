from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.routers.stream_proxy import rewrite_m3u8_manifest

client = TestClient(app)


def test_rewrite_m3u8_manifest_logic():
    sample_manifest = """#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-MAP:URI="init.mp4"
#EXTINF:10.0,
segment_0.ts
#EXTINF:10.0,
https://cdn.example.com/live/segment_1.ts
#EXT-X-ENDLIST"""

    base_url = "https://cdn.example.com/hls/master.m3u8"
    rewritten = rewrite_m3u8_manifest(
        content=sample_manifest,
        base_url=base_url,
        proxy_endpoint="/api/v1/proxy/hls",
        referer="https://cricstream.com",
    )

    assert "#EXTM3U" in rewritten
    assert "#EXT-X-MAP:URI=\"/api/v1/proxy/hls?url=" in rewritten
    assert "init.mp4" in rewritten
    assert "/api/v1/proxy/hls?url=https%3A%2F%2Fcdn.example.com%2Fhls%2Fsegment_0.ts" in rewritten
    assert "/api/v1/proxy/hls?url=https%3A%2F%2Fcdn.example.com%2Flive%2Fsegment_1.ts" in rewritten
    assert "referer=https%3A%2F%2Fcricstream.com" in rewritten


def test_proxy_hls_endpoint():
    sample_content = "#EXTM3U\n#EXTINF:10.0,\nseg1.ts\n#EXT-X-ENDLIST"
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = sample_content
    mock_resp.url = "https://mock-stream.com/live/playlist.m3u8"

    mock_client = AsyncMock()
    mock_client.get.return_value = mock_resp

    with patch("httpx.AsyncClient", return_value=mock_client):
        url = "https://mock-stream.com/live/playlist.m3u8"
        response = client.get(f"/api/v1/proxy/hls?url={url}")
        assert response.status_code == 200
        assert "Access-Control-Allow-Origin" in response.headers
        assert response.headers["Access-Control-Allow-Origin"] == "*"
        assert "application/vnd.apple.mpegurl" in response.headers["Content-Type"]
        content = response.text
        assert "#EXTM3U" in content
        assert "/api/v1/proxy/hls?url=https%3A%2F%2Fmock-stream.com%2Flive%2Fseg1.ts" in content


def test_proxy_hls_invalid_protocol():
    response = client.get("/api/v1/proxy/hls?url=ftp://invalid.com/test.m3u8")
    assert response.status_code == 400
    assert "Invalid stream URL protocol" in response.json()["detail"]
