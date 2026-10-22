from __future__ import annotations

import os
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from backend.app.core.cache import cache
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.schemas import HealthResponse
from backend.app.services.background_worker import score_scheduler

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
async def health_check(db: Session = Depends(get_db)):
    """
    Health check endpoint verifying database connectivity,
    Playwright WebKit browser availability, and background scheduler status.
    """
    # 1. Check Database
    db_status = "connected"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {e}"

    # 2. Check Playwright WebKit installation
    playwright_status = "ready"
    ms_playwright_dir = Path.home() / "Library/Caches/ms-playwright"
    webkit_found = any("webkit" in p.name.lower() for p in ms_playwright_dir.glob("*")) if ms_playwright_dir.exists() else False
    if not webkit_found:
        playwright_status = "warning: WebKit binary directory not detected"

    # 3. Check Scheduler
    scheduler_status = "running" if score_scheduler.is_running else "stopped"

    # 4. In-Memory Cache Stats
    cache_stats = cache.stats()

    return HealthResponse(
        status="healthy" if db_status == "connected" else "degraded",
        version=settings.VERSION,
        database=db_status,
        playwright=playwright_status,
        background_scheduler=scheduler_status,
        cached_matches_count=cache_stats.get("active_keys", 0),
        last_scheduler_run=score_scheduler.last_run,
    )
