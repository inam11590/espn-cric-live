from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from backend.app.core.database import Base


class MatchPoll(Base):
    __tablename__ = "match_polls"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, index=True, nullable=False)
    series_id = Column(Integer, index=True, nullable=True)
    question = Column(String(255), nullable=False)
    options = Column(JSON, nullable=False, default=list)  # [{"id": "1", "text": "Option 1"}]
    votes = Column(JSON, nullable=False, default=dict)     # {"1": 10, "2": 15}
    total_votes = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    poll_votes = relationship("PollVote", back_populates="poll", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        """Convert poll to frontend-friendly dictionary with percentage calculations."""
        votes_map = self.votes or {}
        total = self.total_votes or 0

        options_data = []
        for opt in (self.options or []):
            opt_id = str(opt.get("id"))
            count = votes_map.get(opt_id, 0)
            pct = round((count / total) * 100, 1) if total > 0 else 0.0
            options_data.append({
                "id": opt_id,
                "text": opt.get("text", ""),
                "votes": count,
                "percentage": pct,
            })

        return {
            "id": self.id,
            "match_id": self.match_id,
            "series_id": self.series_id,
            "question": self.question,
            "options": options_data,
            "total_votes": total,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class PollVote(Base):
    __tablename__ = "poll_votes"

    id = Column(Integer, primary_key=True, index=True)
    poll_id = Column(Integer, ForeignKey("match_polls.id"), nullable=False)
    session_id = Column(String(128), index=True, nullable=False)
    option_id = Column(String(64), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    poll = relationship("MatchPoll", back_populates="poll_votes")
