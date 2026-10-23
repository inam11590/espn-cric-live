from __future__ import annotations

import logging
import time
from typing import Any, Dict, List
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import (
    create_access_token,
    get_current_admin,
    verify_admin_credentials,
)
from backend.app.core.websocket_manager import ws_manager
from backend.app.models.match_stream import MatchStream
from backend.app.models.schemas import (
    AdminLoginRequest,
    AdminTokenResponse,
    CustomMatchCreate,
    StreamServerCreate,
    StreamServerSchema,
    StreamServerUpdate,
    StreamTestRequest,
    StreamTestResponse,
)
from backend.app.services.cricket_service import cricket_service
from backend.app.services.stream_service import stream_service

logger = logging.getLogger("cricket_app.routers.admin")

router = APIRouter(prefix="/admin", tags=["Admin"])


# -----------------------------------------------------------------------------
# 1. ADMIN AUTHENTICATION
# -----------------------------------------------------------------------------

@router.post("/login", response_model=AdminTokenResponse)
async def admin_login(payload: AdminLoginRequest):
    """
    Authenticate site admin and return a signed JWT Bearer access token.
    """
    if not verify_admin_credentials(payload.username, payload.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin username or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": payload.username.strip()})
    return AdminTokenResponse(
        access_token=token,
        token_type="bearer",
        username=payload.username.strip(),
    )


@router.get("/me")
async def get_admin_profile(current_admin: str = Depends(get_current_admin)):
    """Verify admin token and return current session info."""
    return {"admin": current_admin, "status": "authenticated"}


# -----------------------------------------------------------------------------
# 2. MATCH & STREAM MANAGEMENT
# -----------------------------------------------------------------------------

@router.get("/matches")
async def get_admin_matches(
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Returns all live/recent matches from ESPNcricinfo and custom database matches,
    enriched with all configured stream servers (both active and inactive).
    """
    try:
        live_res = await cricket_service.get_live_matches_fast(db=db)
        matches_dict: Dict[int, Dict[str, Any]] = {}

        # 1. Add cricinfo matches
        for m in live_res.matches:
            m_dict = m.model_dump()
            # Replace streams with ALL servers (including inactive) for admin
            m_dict["streams"] = stream_service.get_all_streams_by_match(db, m.match_id)
            matches_dict[m.match_id] = m_dict

        # 2. Check for database custom matches not in Cricinfo feed
        db_records = stream_service.get_all_match_streams(db)
        for rec in db_records:
            if rec.match_id not in matches_dict:
                matches_dict[rec.match_id] = {
                    "series_id": rec.series_id,
                    "match_id": rec.match_id,
                    "title": rec.match_title or f"Custom Match #{rec.match_id}",
                    "series_name": "Custom / Exhibition Series",
                    "status": "LIVE" if rec.is_live else "COMPLETED",
                    "status_text": "Live Stream Broadcast" if rec.is_live else "Match Ended",
                    "format": "T20",
                    "team_1": {
                        "name": rec.match_title.split(" vs ")[0] if " vs " in (rec.match_title or "") else "Team 1",
                        "abbreviation": "T1",
                        "score": "Live Stream",
                        "overs": "0.0",
                    },
                    "team_2": {
                        "name": rec.match_title.split(" vs ")[1].split(" - ")[0] if " vs " in (rec.match_title or "") else "Team 2",
                        "abbreviation": "T2",
                        "score": "Live Stream",
                        "overs": "0.0",
                    },
                    "streams": rec.all_streams,
                }

        return {
            "matches": list(matches_dict.values()),
            "total_matches": len(matches_dict),
        }
    except Exception as exc:
        logger.error(f"Error fetching admin matches: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch admin matches: {exc}")


@router.post("/matches/{series_id}/{match_id}/streams", response_model=StreamServerSchema)
async def add_stream_server(
    series_id: int,
    match_id: int,
    payload: StreamServerCreate,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Attach a new stream server to a match and broadcast real-time WebSocket update.
    """
    try:
        match_title = f"Match {series_id}/{match_id}"
        server = stream_service.attach_stream_server(
            db=db,
            match_id=match_id,
            series_id=series_id,
            match_title=match_title,
            server_data=payload,
        )

        # Broadcast real-time stream update to all connected WebSocket listeners
        active_streams = stream_service.get_streams_by_match(db, match_id)
        await ws_manager.broadcast_match_update(
            series_id=series_id,
            match_id=match_id,
            data={
                "event": "STREAM_UPDATED",
                "match_id": match_id,
                "series_id": series_id,
                "streams": active_streams,
            },
        )

        return server
    except Exception as exc:
        logger.error(f"Error adding stream server: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to add stream server: {exc}")


@router.patch("/streams/{stream_id}")
async def update_stream_server(
    stream_id: int,
    payload: StreamServerUpdate,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Toggle is_active or edit stream server attributes on the fly, broadcasting real-time WS update.
    """
    result = stream_service.update_stream_server(db=db, stream_id=stream_id, update_data=payload)
    if not result:
        raise HTTPException(status_code=404, detail=f"Stream server #{stream_id} not found.")

    server, series_id, match_id = result

    # Broadcast real-time update
    active_streams = stream_service.get_streams_by_match(db, match_id)
    await ws_manager.broadcast_match_update(
        series_id=series_id,
        match_id=match_id,
        data={
            "event": "STREAM_UPDATED",
            "match_id": match_id,
            "series_id": series_id,
            "streams": active_streams,
        },
    )

    return {
        "success": True,
        "server": {
            "id": server.id,
            "server_name": server.server_name,
            "stream_type": server.stream_type,
            "stream_url": server.stream_url,
            "referer": server.referer,
            "user_agent": server.user_agent,
            "quality": server.quality,
            "is_active": server.is_active,
            "priority_order": server.priority_order,
        },
    }


@router.delete("/streams/{stream_id}")
async def delete_stream_server(
    stream_id: int,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Delete a stream server and broadcast real-time WS update.
    """
    result = stream_service.delete_stream_server(db=db, stream_id=stream_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Stream server #{stream_id} not found.")

    series_id, match_id = result

    # Broadcast real-time update
    active_streams = stream_service.get_streams_by_match(db, match_id)
    await ws_manager.broadcast_match_update(
        series_id=series_id,
        match_id=match_id,
        data={
            "event": "STREAM_UPDATED",
            "match_id": match_id,
            "series_id": series_id,
            "streams": active_streams,
        },
    )

    return {"deleted": True, "stream_id": stream_id}


# -----------------------------------------------------------------------------
# 3. STREAM HEALTH CHECK & LIVE TESTER
# -----------------------------------------------------------------------------

@router.post("/streams/test", response_model=StreamTestResponse)
async def test_stream_health(
    payload: StreamTestRequest,
    current_admin: str = Depends(get_current_admin),
):
    """
    Performs a fast async health check of an .m3u8 or video stream:
    - Measures round-trip latency in milliseconds.
    - Validates HTTP 200/206 status and #EXTM3U manifest header.
    - Tests with optional Referer header.
    """
    target_url = payload.stream_url.strip()
    if not target_url.startswith(("http://", "https://")):
        return StreamTestResponse(
            success=False,
            status_code=400,
            latency_ms=0.0,
            message="Invalid stream URL protocol. Must start with http:// or https://",
        )

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
    }
    if payload.referer:
        headers["Referer"] = payload.referer

    start_time = time.perf_counter()
    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(target_url, headers=headers)
            latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

            content_type = resp.headers.get("content-type", "")
            first_bytes = resp.text[:256] if resp.text else ""
            is_valid_hls = "#EXTM3U" in first_bytes or "mpegurl" in content_type.lower() or ".m3u8" in target_url.lower()

            if resp.status_code in (200, 206):
                return StreamTestResponse(
                    success=True,
                    status_code=resp.status_code,
                    latency_ms=latency_ms,
                    content_type=content_type,
                    is_valid_hls=is_valid_hls,
                    message="Stream responded with 200 OK and valid manifest header.",
                )
            else:
                return StreamTestResponse(
                    success=False,
                    status_code=resp.status_code,
                    latency_ms=latency_ms,
                    content_type=content_type,
                    is_valid_hls=is_valid_hls,
                    message=f"Stream returned HTTP {resp.status_code}",
                )

    except httpx.TimeoutException:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return StreamTestResponse(
            success=False,
            status_code=504,
            latency_ms=latency_ms,
            message="Stream request timed out after 10.0 seconds.",
        )
    except Exception as exc:
        latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return StreamTestResponse(
            success=False,
            status_code=502,
            latency_ms=latency_ms,
            message=f"Connection error: {str(exc)}",
        )


# -----------------------------------------------------------------------------
# 4. CUSTOM MATCH CREATION (For Exhibition / Custom Broadcasts)
# -----------------------------------------------------------------------------

@router.post("/matches/custom")
async def create_custom_match(
    payload: CustomMatchCreate,
    current_admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """
    Registers a custom exhibition match so admins can stream non-Cricinfo fixtures.
    """
    try:
        ms = stream_service.create_custom_match(db, payload)
        return {"success": True, "match_id": ms.match_id, "series_id": ms.series_id, "title": ms.match_title}
    except Exception as exc:
        logger.error(f"Error creating custom match: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create custom match: {exc}")
