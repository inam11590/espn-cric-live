import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
FIXTURES_DIR = BASE_DIR / "fixtures"
STATIC_DIR = BASE_DIR / "static"

# Cache TTLs (in seconds)
# Requirement: Live match scores for 15-30 seconds
LIVE_CACHE_TTL = int(os.getenv("LIVE_CACHE_TTL", "20"))

# Requirement: Completed match scorecards and player profiles for 24 hours (86400s)
MATCH_DETAIL_CACHE_TTL = int(os.getenv("MATCH_DETAIL_CACHE_TTL", "86400"))
PLAYER_PROFILE_CACHE_TTL = int(os.getenv("PLAYER_PROFILE_CACHE_TTL", "86400"))

# Scraping timeouts
SCRAPE_TIMEOUT_SECONDS = int(os.getenv("SCRAPE_TIMEOUT_SECONDS", "30"))

# Server settings
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "false").lower() in ("true", "1", "t")
