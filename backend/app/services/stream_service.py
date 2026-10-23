from __future__ import annotations

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy.orm import Session

from backend.app.models.match_stream import MatchStream, StreamServer
from backend.app.models.schemas import (
    CustomMatchCreate,
    MatchStreamCreate,
    StreamServerCreate,
    StreamServerSchema,
    StreamServerUpdate,
)


class StreamService:
    @staticmethod
    def get_streams_by_match(db: Session, match_id: int) -> List[Dict[str, Any]]:
        """Retrieve all active video streams attached to a specific match for public users."""
        ms = db.query(MatchStream).filter(MatchStream.match_id == match_id).first()
        if ms:
            return ms.streams
        return []

    @staticmethod
    def get_all_streams_by_match(db: Session, match_id: int) -> List[Dict[str, Any]]:
        """Retrieve all stream servers (active and inactive) for admin management."""
        ms = db.query(MatchStream).filter(MatchStream.match_id == match_id).first()
        if ms:
            return ms.all_streams
        return []

    @staticmethod
    def get_match_stream_record(db: Session, match_id: int) -> Optional[MatchStream]:
        return db.query(MatchStream).filter(MatchStream.match_id == match_id).first()

    @staticmethod
    def get_all_match_streams(db: Session) -> List[MatchStream]:
        return db.query(MatchStream).all()

    @staticmethod
    def attach_stream_server(
        db: Session,
        match_id: int,
        series_id: int,
        match_title: str,
        server_data: StreamServerCreate | StreamServerSchema,
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
            referer=server_data.referer,
            user_agent=server_data.user_agent,
            quality=server_data.quality,
            is_active=server_data.is_active,
            priority_order=server_data.priority_order or 0,
        )
        db.add(server)
        db.commit()
        db.refresh(server)
        return server

    @staticmethod
    def update_stream_server(
        db: Session, stream_id: int, update_data: StreamServerUpdate
    ) -> Optional[Tuple[StreamServer, int, int]]:
        """
        Updates an existing stream server and returns (server, series_id, match_id).
        """
        server = db.query(StreamServer).filter(StreamServer.id == stream_id).first()
        if not server:
            return None

        if update_data.server_name is not None:
            server.server_name = update_data.server_name
        if update_data.stream_type is not None:
            server.stream_type = update_data.stream_type
        if update_data.stream_url is not None:
            server.stream_url = update_data.stream_url
        if update_data.referer is not None:
            server.referer = update_data.referer
        if update_data.user_agent is not None:
            server.user_agent = update_data.user_agent
        if update_data.quality is not None:
            server.quality = update_data.quality
        if update_data.is_active is not None:
            server.is_active = update_data.is_active
        if update_data.priority_order is not None:
            server.priority_order = update_data.priority_order

        db.commit()
        db.refresh(server)

        ms = server.match_stream
        return server, ms.series_id, ms.match_id

    @staticmethod
    def delete_stream_server(db: Session, stream_id: int) -> Optional[Tuple[int, int]]:
        """
        Deletes a stream server and returns (series_id, match_id) of the parent match.
        """
        server = db.query(StreamServer).filter(StreamServer.id == stream_id).first()
        if not server:
            return None

        ms = server.match_stream
        series_id = ms.series_id
        match_id = ms.match_id

        db.delete(server)
        db.commit()
        return series_id, match_id

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
                referer=srv.referer,
                user_agent=srv.user_agent,
                quality=srv.quality,
                is_active=srv.is_active,
                priority_order=srv.priority_order or 0,
            )
            db.add(server)

        db.commit()
        db.refresh(ms)
        return ms

    @staticmethod
    def create_custom_match(db: Session, data: CustomMatchCreate) -> MatchStream:
        """Creates or registers a custom match in the MatchStream table."""
        ms = db.query(MatchStream).filter(MatchStream.match_id == data.match_id).first()
        if not ms:
            ms = MatchStream(
                match_id=data.match_id,
                series_id=data.series_id,
                match_title=f"{data.team_1_name} vs {data.team_2_name} - {data.match_title}",
                is_live=(data.status == "LIVE"),
            )
            db.add(ms)
            db.commit()
            db.refresh(ms)
        return ms


stream_service = StreamService()
