from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class MatchStream(Base):
    __tablename__ = "match_streams"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, index=True, nullable=False)
    series_id = Column(Integer, index=True, nullable=False)
    match_title = Column(String(255), nullable=True)
    is_live = Column(Boolean, default=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relational list of stream servers
    servers = relationship(
        "StreamServer",
        back_populates="match_stream",
        cascade="all, delete-orphan",
        lazy="joined",
    )

    @property
    def streams(self) -> List[Dict[str, Any]]:
        """Returns clean list of active server dicts for public JSON output."""
        active = [
            {
                "id": s.id,
                "server_name": s.server_name,
                "stream_type": s.stream_type,
                "stream_url": s.stream_url,
                "referer": s.referer,
                "user_agent": s.user_agent,
                "quality": s.quality,
                "is_active": s.is_active,
                "priority_order": s.priority_order or 0,
            }
            for s in self.servers
            if s.is_active
        ]
        return sorted(active, key=lambda x: x["priority_order"])

    @property
    def all_streams(self) -> List[Dict[str, Any]]:
        """Returns all server dicts (including inactive) for Admin panel."""
        servers = [
            {
                "id": s.id,
                "server_name": s.server_name,
                "stream_type": s.stream_type,
                "stream_url": s.stream_url,
                "referer": s.referer,
                "user_agent": s.user_agent,
                "quality": s.quality,
                "is_active": s.is_active,
                "priority_order": s.priority_order or 0,
            }
            for s in self.servers
        ]
        return sorted(servers, key=lambda x: (not x["is_active"], x["priority_order"]))


class StreamServer(Base):
    __tablename__ = "stream_servers"

    id = Column(Integer, primary_key=True, index=True)
    match_stream_id = Column(Integer, ForeignKey("match_streams.id"), nullable=False)
    server_name = Column(String(100), nullable=False)  # "HD Server 1", "Backup Stream"
    stream_type = Column(String(20), nullable=False, default="hls")  # "hls", "proxy_hls", or "iframe"
    stream_url = Column(String(1024), nullable=False)
    referer = Column(String(512), nullable=True)
    user_agent = Column(String(512), nullable=True)
    quality = Column(String(50), default="1080p")  # "1080p", "720p", "Auto"
    is_active = Column(Boolean, default=True)
    priority_order = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    match_stream = relationship("MatchStream", back_populates="servers")
