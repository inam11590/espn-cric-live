from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
import json
from pathlib import Path
from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal, init_db
from backend.app.core.websocket_manager import ws_manager
from backend.app.routers import admin, health, matches, players, polls, stream_proxy
from backend.app.services.background_worker import score_scheduler
from backend.app.services.chat_manager import chat_manager
from backend.app.services.cricket_service import cricket_service

logging.basicConfig(
    level=logging.INFO if not settings.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cricket_app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager: initializes DB and starts APScheduler on startup."""
    logger.info("Initializing Live Cricket Streaming & Score Engine...")
    init_db()

    # Prime cache on startup
    db = SessionLocal()
    try:
        await cricket_service.refresh_live_matches(db=db)
    except Exception as e:
        logger.warning(f"Initial live match scrape notice: {e}")
    finally:
        db.close()

    # Start APScheduler 20s background worker
    score_scheduler.start()

    yield

    # Shutdown
    logger.info("Shutting down background scheduler...")
    score_scheduler.stop()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "Production-grade Live Cricket Streaming & Real-Time Score Engine. "
        "Integrates python-espncricinfo with Playwright WebKit scraping, APScheduler "
        "20-second non-blocking cache updates, WebSockets, and relational/JSON video stream mapping."
    ),
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include v1 routers
app.include_router(health.router, prefix=settings.API_V1_STR)
app.include_router(polls.router, prefix=settings.API_V1_STR)
app.include_router(matches.router, prefix=settings.API_V1_STR)
app.include_router(players.router, prefix=settings.API_V1_STR)
app.include_router(stream_proxy.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)


# -----------------------------------------------------------------------------
# WebSocket: /ws/matches/{series_id}/{match_id}
# -----------------------------------------------------------------------------

@app.websocket("/ws/matches/{series_id}/{match_id}")
async def ws_match_stream_endpoint(
    websocket: WebSocket,
    series_id: int,
    match_id: int,
):
    """
    Direct WebSocket connection for real-time match scores and live video stream status updates.
    """
    await ws_manager.connect_match(websocket, series_id, match_id)
    db = SessionLocal()
    try:
        current_state = await cricket_service.get_match_detail(series_id, match_id, db=db)
        await websocket.send_json({
            "event": "connected",
            "match_id": match_id,
            "series_id": series_id,
            "data": current_state.model_dump(),
        })

        while True:
            text = await websocket.receive_text()
            if text == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_match(websocket, series_id, match_id)
    except Exception as e:
        logger.warning(f"WS error on match {series_id}/{match_id}: {e}")
        ws_manager.disconnect_match(websocket, series_id, match_id)
    finally:
        db.close()


# -----------------------------------------------------------------------------
# WebSocket: /ws/chat/{series_id}/{match_id}
# -----------------------------------------------------------------------------

@app.websocket("/ws/chat/{series_id}/{match_id}")
async def ws_chat_room_endpoint(
    websocket: WebSocket,
    series_id: int,
    match_id: int,
):
    """
    WebSocket endpoint for real-time live match chat, flying emoji reactions,
    active viewer counts, and prediction poll broadcasts.
    """
    room_id = chat_manager.get_room_id(series_id, match_id)
    client_host = websocket.client.host if websocket.client else "unknown"
    client_id = f"{client_host}:{id(websocket)}"

    await chat_manager.connect(websocket, room_id)
    try:
        while True:
            text = await websocket.receive_text()
            try:
                data = json.loads(text)
            except (json.JSONDecodeError, TypeError):
                continue

            effective_client_id = str(data.get("user_id") or client_id)
            await chat_manager.handle_incoming(room_id, effective_client_id, data, websocket)
    except WebSocketDisconnect:
        await chat_manager.disconnect(websocket, room_id)
    except Exception as e:
        logger.debug(f"WS chat exception in room {room_id}: {e}")
        await chat_manager.disconnect(websocket, room_id)



# Mount static assets & frontend dashboard
frontend_dist = settings.BASE_DIR / "frontend" / "dist"
if (frontend_dist / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

static_path = settings.STATIC_DIR
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/", include_in_schema=False)
@app.get("/{full_path:path}", include_in_schema=False)
async def serve_index(full_path: str = ""):
    if full_path.startswith(("api/", "docs", "openapi.json", "ws/")):
        raise HTTPException(status_code=404, detail="Not Found")
    react_index = frontend_dist / "index.html"
    if react_index.exists():
        return FileResponse(str(react_index))
    static_index = static_path / "index.html"
    if static_index.exists():
        return FileResponse(str(static_index))
    return JSONResponse({"status": "healthy", "docs": "/docs"})
