from __future__ import annotations

import json
import logging
from typing import Dict, List, Set
from fastapi import WebSocket

logger = logging.getLogger("cricket_app.websocket")


class ConnectionManager:
    """
    Manages active WebSocket connections for real-time match and live score updates.
    """

    def __init__(self):
        # Maps (series_id, match_id) -> Set of WebSockets
        self.match_connections: Dict[str, Set[WebSocket]] = {}
        # Global live ticker connections
        self.ticker_connections: Set[WebSocket] = set()

    def _key(self, series_id: int, match_id: int) -> str:
        return f"{series_id}:{match_id}"

    async def connect_match(self, websocket: WebSocket, series_id: int, match_id: int):
        await websocket.accept()
        key = self._key(series_id, match_id)
        if key not in self.match_connections:
            self.match_connections[key] = set()
        self.match_connections[key].add(websocket)
        logger.info(f"WebSocket connected for match {key}. Total listeners: {len(self.match_connections[key])}")

    def disconnect_match(self, websocket: WebSocket, series_id: int, match_id: int):
        key = self._key(series_id, match_id)
        if key in self.match_connections and websocket in self.match_connections[key]:
            self.match_connections[key].remove(websocket)
            if not self.match_connections[key]:
                del self.match_connections[key]
        logger.info(f"WebSocket disconnected from match {key}")

    async def broadcast_match_update(self, series_id: int, match_id: int, data: dict):
        key = self._key(series_id, match_id)
        connections = self.match_connections.get(key, set())
        if not connections:
            return

        dead_connections = []
        payload = json.dumps(data)
        for ws in connections:
            try:
                await ws.send_text(payload)
            except Exception as e:
                logger.warning(f"Error broadcasting to WebSocket on match {key}: {e}")
                dead_connections.append(ws)

        for ws in dead_connections:
            connections.discard(ws)

    async def connect_ticker(self, websocket: WebSocket):
        await websocket.accept()
        self.ticker_connections.add(websocket)

    def disconnect_ticker(self, websocket: WebSocket):
        self.ticker_connections.discard(websocket)

    async def broadcast_ticker(self, data: dict):
        if not self.ticker_connections:
            return
        dead = []
        payload = json.dumps(data)
        for ws in self.ticker_connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.ticker_connections.discard(ws)


ws_manager = ConnectionManager()
