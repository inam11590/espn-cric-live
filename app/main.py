from __future__ import annotations

import logging
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app import config
from app.cache import cache
from app.routes import matches, players

logging.basicConfig(
    level=logging.INFO if not config.DEBUG else logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("cricket_app")

app = FastAPI(
    title="Live Cricket Streaming & Live Score API",
    description=(
        "Production-grade live cricket scores and streaming API powered by "
        "espncricinfo with Playwright WebKit scraping, resilient in-memory TTL caching, "
        "and modular live streaming video components."
    ),
    version="1.0.0",
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(matches.router)
app.include_router(players.router)


@app.get("/api/health", tags=["Health"])
async def health_check():
    """Health and status check endpoint."""
    return {
        "status": "healthy",
        "service": "cricket-streaming-live-scores",
        "version": "1.0.0",
        "playwright_browser": "WebKit",
        "cache_ttl": {
            "live_matches_seconds": config.LIVE_CACHE_TTL,
            "match_detail_seconds": config.MATCH_DETAIL_CACHE_TTL,
            "player_profile_seconds": config.PLAYER_PROFILE_CACHE_TTL,
        },
    }


@app.get("/api/cache/stats", tags=["Cache"])
async def get_cache_stats():
    """Diagnostic endpoint to inspect active cache keys, hit ratios, and memory stats."""
    return cache.stats()


@app.post("/api/cache/clear", tags=["Cache"])
async def clear_cache():
    """Manually clear the in-memory cache."""
    cache.clear()
    return {"status": "success", "message": "Cache successfully cleared."}


# Mount static assets
static_path = Path(__file__).resolve().parent.parent / "static"
if static_path.exists():
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")


@app.get("/", include_in_schema=False)
async def serve_dashboard():
    """Serve the responsive web dashboard."""
    index_file = static_path / "index.html"
    if index_file.exists():
        return FileResponse(str(index_file))
    return JSONResponse(
        {
            "message": "Welcome to Live Cricket Streaming API. Visit /docs for the interactive OpenAPI documentation."
        }
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "message": "The cricket scraper encountered an unexpected error. Please retry or inspect cache stats.",
            "detail": str(exc),
        },
    )
