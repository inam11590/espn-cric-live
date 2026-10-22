from __future__ import annotations

from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from backend.app.models.match_stream import MatchStream, StreamServer
from backend.app.models.schemas import MatchStreamCreate, StreamServerSchema


class StreamService:
    @staticmethod
    def get_streams_by_match(db: Session, match_id: int) -> List[Dict[str, Any]]:
        """Retrieve all active video streams attached to a specific match."""
        ms = db.query(MatchStream).filter(MatchStream.match_id == match_id).first()
        if ms:
            return ms.streams
        return []

    @staticmethod
    def get_match_stream_record(db: Session, match_id: int) -> Optional[MatchStream]:
        return db.query(MatchStream).filter(MatchStream.match_id == match_id).first()

    @staticmethod
    def attach_stream_server(
        db: Session, match_id: int, series_id: int, match_title: str, server_data: StreamServerSchema
    ) -> StreamServer:
        """Attach a new stream server to a match, creating the MatchStream parent if needed."""
        ms = db.query(MatchStream).filter(MatchStream.match_id == match_id).first()
        if not ms:
            ms = MatchStream(
                match_id=match_id,
                series_id=series_id,
                match_title=match_title,
                is_live=True,
            )
            db.add(ms)
            db.flush()

        server = StreamServer(
            match_stream_id=ms.id,
            server_name=server_data.server_name,
            stream_type=server_data.stream_type,
            stream_url=server_data.stream_url,
            quality=server_data.quality,
            is_active=server_data.is_active,
        )
        db.add(server)
        db.commit()
        db.refresh(server)
        return server

    @staticmethod
    def create_or_update_stream(db: Session, data: MatchStreamCreate) -> MatchStream:
        """Create or update full stream configuration for a match."""
        ms = db.query(MatchStream).filter(MatchStream.match_id == data.match_id).first()
        if not ms:
            ms = MatchStream(
                match_id=data.match_id,
                series_id=data.series_id,
                match_title=data.match_title,
                is_live=data.is_live,
            )
            db.add(ms)
            db.flush()
        else:
            ms.series_id = data.series_id
            if data.match_title:
                ms.match_title = data.match_title
            ms.is_live = data.is_live
            # Clear old servers if replacing
            db.query(StreamServer).filter(StreamServer.match_stream_id == ms.id).delete()

        for srv in data.servers:
            server = StreamServer(
                match_stream_id=ms.id,
                server_name=srv.server_name,
                stream_type=srv.stream_type,
                stream_url=srv.stream_url,
                quality=srv.quality,
                is_active=srv.is_active,
            )
            db.add(server)

        db.commit()
        db.refresh(ms)
        return ms


stream_service = StreamService()
