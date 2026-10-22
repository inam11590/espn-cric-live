from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from backend.app.core.config import settings
from backend.app.core.database import SessionLocal
from backend.app.services.cricket_service import cricket_service

logger = logging.getLogger("cricket_app.worker")


class LiveScoreScheduler:
    def __init__(self):
        self.scheduler: Optional[AsyncIOScheduler] = None
        self.last_run: Optional[str] = None
        self.run_count: int = 0
        self.is_running: bool = False

    async def _scheduled_task(self):
        """Worker task that runs every 20 seconds."""
        self.run_count += 1
        self.last_run = datetime.utcnow().isoformat() + "Z"
        logger.debug(f"APScheduler: Starting 20s live match refresh cycle #{self.run_count}...")

        db = SessionLocal()
        try:
            await cricket_service.refresh_live_matches(db=db)
            logger.debug("APScheduler: Live match cycle completed.")
        except Exception as e:
            logger.error(f"APScheduler error in live match refresh: {e}", exc_info=True)
        finally:
            db.close()

    def start(self):
        if self.is_running:
            return

        self.scheduler = AsyncIOScheduler()
        self.scheduler.add_job(
            self._scheduled_task,
            trigger=IntervalTrigger(seconds=settings.SCRAPE_INTERVAL_SECONDS),
            id="live_score_refresh_job",
            name="Scrape Cricinfo Live Scores every 20s",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        self.scheduler.start()
        self.is_running = True
        logger.info(f"APScheduler started: refreshing live scores every {settings.SCRAPE_INTERVAL_SECONDS} seconds.")

    def stop(self):
        if self.scheduler and self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("APScheduler stopped.")


score_scheduler = LiveScoreScheduler()
