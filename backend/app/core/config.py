from __future__ import annotations

import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
FIXTURES_DIR = BASE_DIR / "fixtures"
STATIC_DIR = BASE_DIR / "static"


class Settings(BaseModel):
    PROJECT_NAME: str = "Live Cricket Streaming & Score API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"

    BASE_DIR: Path = BASE_DIR
    FIXTURES_DIR: Path = FIXTURES_DIR
    STATIC_DIR: Path = STATIC_DIR

    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/cricket_streams.db")

    # Scraper & Caching Guardrails
    SCRAPE_INTERVAL_SECONDS: int = int(os.getenv("SCRAPE_INTERVAL_SECONDS", "20"))
    SCRAPE_TIMEOUT_SECONDS: int = int(os.getenv("SCRAPE_TIMEOUT_SECONDS", "25"))
    CACHE_LIVE_TTL: int = int(os.getenv("CACHE_LIVE_TTL", "20"))
    CACHE_DETAIL_TTL: int = int(os.getenv("CACHE_DETAIL_TTL", "86400"))

    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    DEBUG: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "t")

    model_config = {"arbitrary_types_allowed": True}


settings = Settings()
