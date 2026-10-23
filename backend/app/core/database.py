from __future__ import annotations

import logging
from pathlib import Path
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

from backend.app.core.config import settings

logger = logging.getLogger("cricket_app.database")

connect_args = {}
if settings.DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
    # Ensure database parent directory exists (e.g. /app/data)
    try:
        db_path = settings.DATABASE_URL.split("sqlite:///")[-1]
        if db_path and not db_path.startswith(":memory:"):
            Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    except Exception:
        pass

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency for database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database tables and seed sample streams if empty."""
    from backend.app.models.match_stream import MatchStream, StreamServer

    Base.metadata.create_all(bind=engine)

    # SQLite lightweight column migration for added stream attributes
    with engine.connect() as conn:
        for col_def in [
            "ALTER TABLE stream_servers ADD COLUMN referer VARCHAR(512)",
            "ALTER TABLE stream_servers ADD COLUMN user_agent VARCHAR(512)",
            "ALTER TABLE stream_servers ADD COLUMN priority_order INTEGER DEFAULT 0",
        ]:
            try:
                conn.execute(text(col_def))
                conn.commit()
            except Exception:
                pass

    logger.info("Database schema initialized.")

    # Seed default streams if empty
    db = SessionLocal()
    try:
        count = db.query(MatchStream).count()
        if count == 0:
            logger.info("Seeding default match streams...")
            sample_matches = [
                {
                    "match_id": 1478914,
                    "series_id": 1478874,
                    "match_title": "IND Women vs AUS Women - 3rd T20I",
                    "is_live": False,
                    "servers": [
                        {
                            "server_name": "Main HD Server (1080p)",
                            "stream_type": "hls",
                            "stream_url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                            "quality": "1080p",
                            "is_active": True,
                        },
                        {
                            "server_name": "CORS Proxy HLS (Bypass)",
                            "stream_type": "proxy_hls",
                            "stream_url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                            "quality": "1080p",
                            "is_active": True,
                        },
                        {
                            "server_name": "Backup Stream (720p)",
                            "stream_type": "hls",
                            "stream_url": "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
                            "quality": "720p",
                            "is_active": True,
                        },
                        {
                            "server_name": "World Feed (Iframe Embed)",
                            "stream_type": "iframe",
                            "stream_url": "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1",
                            "quality": "1080p",
                            "is_active": True,
                        },
                    ],
                },
                {
                    "match_id": 1466520,
                    "series_id": 1466487,
                    "match_title": "India vs England - 2nd Test, Day 4",
                    "is_live": True,
                    "servers": [
                        {
                            "server_name": "Primary 4K/1080p Stream",
                            "stream_type": "hls",
                            "stream_url": "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
                            "quality": "1080p",
                            "is_active": True,
                        },
                        {
                            "server_name": "Spider Cam Feed",
                            "stream_type": "hls",
                            "stream_url": "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8",
                            "quality": "720p",
                            "is_active": True,
                        },
                    ],
                },
                {
                    "match_id": 1472235,
                    "series_id": 1472210,
                    "match_title": "Pakistan vs South Africa - 1st ODI",
                    "is_live": True,
                    "servers": [
                        {
                            "server_name": "Live Broadcast Server 1",
                            "stream_type": "hls",
                            "stream_url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                            "quality": "1080p",
                            "is_active": True,
                        },
                    ],
                },
            ]

            for s_data in sample_matches:
                servers = [
                    StreamServer(
                        server_name=srv["server_name"],
                        stream_type=srv["stream_type"],
                        stream_url=srv["stream_url"],
                        quality=srv["quality"],
                        is_active=srv["is_active"],
                    )
                    for srv in s_data["servers"]
                ]
                ms = MatchStream(
                    match_id=s_data["match_id"],
                    series_id=s_data["series_id"],
                    match_title=s_data["match_title"],
                    is_live=s_data["is_live"],
                    servers=servers,
                )
                db.add(ms)
            db.commit()
            logger.info("Default match streams successfully seeded.")
    except Exception as e:
        logger.error(f"Error during init_db: {e}")
        db.rollback()
    finally:
        db.close()
