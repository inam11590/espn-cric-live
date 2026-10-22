from __future__ import annotations

import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.websocket_manager import ws_manager
from backend.app.models.schemas import (
    LiveMatchesResponse,
    MatchDetailSchema,
    MatchStreamCreate,
    MatchStreamResponse,
)
from backend.app.services.cricket_service import cricket_service
from backend.app.services.stream_service import stream_service
from espncricinfo.exceptions import MatchNotFoundError

logger = logging.getLogger("cricket_app.routers.matches")

router = APIRouter(prefix="/matches", tags=["Matches"])


@router.get("/live", response_model=LiveMatchesResponse)
async def get_live_matches(db: Session = Depends(get_db)):
    """
    Returns all current/recent matches enriched with their attached video streams from the database.
    Ultra-low latency (<20ms) served from in-memory cache populated by background scheduler.
    """
    try:
        return await cricket_service.get_live_matches_fast(db=db)
    except Exception as exc:
        logger.error(f"Error fetching live matches: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch live matches: {exc}")


@router.get("/{series_id}/{match_id}", response_model=MatchDetailSchema)
async def get_match_detail(
    series_id: int,
    match_id: int,
    refresh: bool = Query(False, description="Bypass cache for forced refresh"),
    db: Session = Depends(get_db),
):
    """
    Returns full match details, status, toss, batting scorecard, bowling scorecard,
    and available live stream servers from database.
    """
    try:
        return await cricket_service.get_match_detail(
            series_id=series_id, match_id=match_id, db=db, force_refresh=refresh
        )
    except MatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error(f"Error fetching scorecard for match {series_id}/{match_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch match scorecard: {exc}")


@router.post("/streams", response_model=MatchStreamResponse)
async def configure_match_streams(
    data: MatchStreamCreate,
    db: Session = Depends(get_db),
):
    """
    Configure or update live video stream servers (.m3u8 HLS / iframe embeds)
    attached to an ESPNcricinfo match.
    """
    try:
        ms = stream_service.create_or_update_stream(db, data)
        return ms
    except Exception as exc:
        logger.error(f"Error configuring match streams: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to configure streams: {exc}")


# -----------------------------------------------------------------------------
# WebSocket Endpoint for Real-Time Scores & Stream Status Updates
# -----------------------------------------------------------------------------

@router.websocket("/ws/{series_id}/{match_id}")
async def match_realtime_websocket(
    websocket: WebSocket,
    series_id: int,
    match_id: int,
    db: Session = Depends(get_db),
):
    """
    WebSocket endpoint that pushes real-time score and stream status updates
    to connected clients whenever the background worker refreshes data.
    """
    await ws_manager.connect_match(websocket, series_id, match_id)
    try:
        # Immediately send current match state upon connection
        current_state = await cricket_service.get_match_detail(series_id, match_id, db=db)
        await websocket.send_json({
            "event": "initial_state",
            "data": current_state.model_dump(),
        })

        # Keep connection open listening for client ping / messages
        while True:
            client_msg = await websocket.receive_text()
            if client_msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_match(websocket, series_id, match_id)
    except Exception as e:
        logger.warning(f"WebSocket session error for {series_id}/{match_id}: {e}")
        ws_manager.disconnect_match(websocket, series_id, match_id)
