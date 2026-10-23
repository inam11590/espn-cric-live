from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime
import json
import logging
import random
import re
import time
from typing import Any, Dict, List, Optional, Set
from uuid import uuid4
from fastapi import WebSocket

logger = logging.getLogger("cricket_app.chat_manager")

# -----------------------------------------------------------------------------
# Moderation & Nickname Utilities
# -----------------------------------------------------------------------------

PROFANITY_WORDS = {
    "bastard", "bitch", "crap", "damn", "dick", "douche", "fag", "fuck", 
    "nigger", "nigga", "piss", "pussy", "shit", "slut", "whore", "asshole",
    "chutiya", "madarchod", "bhenchod", "gaand", "harami", "saala", "kamina"
}

# Precompile case-insensitive word boundary regex pattern
_PROFANITY_PATTERN = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in PROFANITY_WORDS) + r")\b",
    re.IGNORECASE
)


def filter_profanity(text: str) -> str:
    """Mask offensive words with asterisks of the exact same length."""
    if not text:
        return ""
    
    def _replacer(match: re.Match) -> str:
        word = match.group(0)
        return "*" * len(word)

    return _PROFANITY_PATTERN.sub(_replacer, text)


CRICKET_PREFIXES = [
    "CoverDrive", "GooglyMaster", "YorkerKing", "HelicopterShot", "SillyPoint",
    "DoosraGuru", "ReverseSweep", "SquareCut", "BouncerAce", "UpperCut",
    "ThirdUmpire", "LegGlance", "PinchHitter", "MaidenOver", "HatTrickHero",
    "SwitchHit", "StraightDrive", "PullShot", "FineLeg", "DeepMidwicket"
]

AVATAR_COLORS = [
    "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
    "#EC4899", "#06B6D4", "#F97316", "#14B8A6", "#6366F1"
]


def generate_random_nickname() -> str:
    """Generate a cricket-themed anonymous handle e.g. CoverDrive_42."""
    prefix = random.choice(CRICKET_PREFIXES)
    number = random.randint(10, 99)
    return f"{prefix}_{number}"


def get_random_avatar_color() -> str:
    """Pick a vibrant avatar background color."""
    return random.choice(AVATAR_COLORS)


# -----------------------------------------------------------------------------
# WebSocket Chat & Reaction Connection Manager
# -----------------------------------------------------------------------------

class ChatManager:
    """
    Manages match-specific real-time chat rooms, flying emoji reactions,
    in-memory recent message history, active viewer tracking, and moderation.
    """

    def __init__(self, max_history: int = 50, rate_limit_seconds: float = 2.0):
        # room_id -> Set of active WebSockets
        self.active_rooms: Dict[str, Set[WebSocket]] = defaultdict(set)
        # room_id -> List of recent message dicts (up to max_history)
        self.room_history: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        # client_id -> last message Unix timestamp
        self.last_message_timestamps: Dict[str, float] = {}
        self.max_history = max_history
        self.rate_limit_seconds = rate_limit_seconds
        self._lock = asyncio.Lock()

    @staticmethod
    def get_room_id(series_id: Any, match_id: Any) -> str:
        """Create a consistent room ID string from series_id and match_id."""
        return f"{series_id}:{match_id}"

    async def connect(self, websocket: WebSocket, room_id: str):
        """Accept WebSocket connection, register to room, send history & viewer count."""
        await websocket.accept()
        async with self._lock:
            self.active_rooms[room_id].add(websocket)
            viewer_count = len(self.active_rooms[room_id])
            history_snapshot = list(self.room_history[room_id])

        # Send initial room state to newly connected client
        await self.send_personal(websocket, {
            "type": "chat_history",
            "messages": history_snapshot,
            "viewer_count": viewer_count,
        })

        # Broadcast updated viewer count to everyone in the room
        await self.broadcast_viewer_count(room_id, viewer_count)
        logger.info(f"WebSocket client joined room {room_id}. Total viewers: {viewer_count}")

    async def disconnect(self, websocket: WebSocket, room_id: str):
        """Cleanly unregister WebSocket and broadcast updated viewer count."""
        async with self._lock:
            if room_id in self.active_rooms and websocket in self.active_rooms[room_id]:
                self.active_rooms[room_id].remove(websocket)
            viewer_count = len(self.active_rooms[room_id])

        await self.broadcast_viewer_count(room_id, viewer_count)
        logger.info(f"WebSocket client left room {room_id}. Remaining viewers: {viewer_count}")

    async def send_personal(self, websocket: WebSocket, payload: Dict[str, Any]):
        """Safely send JSON message to a single client."""
        try:
            await websocket.send_text(json.dumps(payload))
        except Exception as e:
            logger.debug(f"Failed to send personal message to WebSocket: {e}")

    async def broadcast_to_room(self, room_id: str, payload: Dict[str, Any]):
        """Broadcast payload to all connected clients in the match room."""
        async with self._lock:
            sockets = list(self.active_rooms.get(room_id, set()))

        if not sockets:
            return

        message_text = json.dumps(payload)
        dead_sockets: List[WebSocket] = []

        for ws in sockets:
            try:
                await ws.send_text(message_text)
            except Exception:
                dead_sockets.append(ws)

        if dead_sockets:
            async with self._lock:
                for ws in dead_sockets:
                    if ws in self.active_rooms[room_id]:
                        self.active_rooms[room_id].remove(ws)

    async def broadcast_viewer_count(self, room_id: str, count: int):
        """Notify room of updated viewer count."""
        await self.broadcast_to_room(room_id, {
            "type": "viewer_count",
            "count": count,
        })

    async def handle_incoming(
        self,
        room_id: str,
        client_id: str,
        data: Dict[str, Any],
        websocket: WebSocket
    ):
        """
        Handle incoming WebSocket payload from a client with validation,
        rate-limiting, and moderation.
        """
        msg_type = data.get("type", "chat_message")

        # 1. PING/PONG keepalive
        if msg_type == "ping":
            await self.send_personal(websocket, {"type": "pong"})
            return

        # 2. FLYING EMOJI REACTION
        if msg_type == "reaction":
            emoji = str(data.get("emoji", "🔥")).strip()
            # Allowed reaction emojis
            allowed_emojis = {"🏏", "🔥", "6️⃣", "4️⃣", "☝️", "👏", "⚡", "🙌", "💥", "❤️"}
            if emoji not in allowed_emojis:
                emoji = "🔥"

            sender = str(data.get("username", "Fan"))[:30]
            reaction_event = {
                "type": "reaction",
                "emoji": emoji,
                "sender": sender,
                "id": uuid4().hex[:8],
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }
            await self.broadcast_to_room(room_id, reaction_event)
            return

        # 3. LIVE CHAT MESSAGE
        if msg_type == "chat_message":
            # Rate limiting guardrail (2 seconds per client)
            now = time.time()
            last_sent = self.last_message_timestamps.get(client_id, 0.0)
            if now - last_sent < self.rate_limit_seconds:
                remaining = round(self.rate_limit_seconds - (now - last_sent), 1)
                await self.send_personal(websocket, {
                    "type": "error",
                    "code": "RATE_LIMITED",
                    "message": f"Slow down! Please wait {remaining}s before sending another message.",
                })
                return

            raw_text = str(data.get("message", "")).strip()
            if not raw_text:
                return

            # Max 160 characters length limit
            if len(raw_text) > 160:
                raw_text = raw_text[:160]

            # Apply profanity filter
            clean_text = filter_profanity(raw_text)

            username = str(data.get("username") or generate_random_nickname()).strip()[:30]
            avatar_color = str(data.get("avatar_color") or "#3B82F6")
            user_id = str(data.get("user_id") or client_id)[:64]
            badge = data.get("badge")  # Optional badge e.g. "Admin", "Mod"

            msg_payload = {
                "id": uuid4().hex[:12],
                "type": "chat_message",
                "user_id": user_id,
                "username": username,
                "avatar_color": avatar_color,
                "message": clean_text,
                "badge": badge,
                "timestamp": datetime.utcnow().isoformat() + "Z",
            }

            # Update client rate limit tracker
            self.last_message_timestamps[client_id] = now

            # Store in in-memory ring buffer (up to max_history)
            async with self._lock:
                history = self.room_history[room_id]
                history.append(msg_payload)
                if len(history) > self.max_history:
                    self.room_history[room_id] = history[-self.max_history:]

            # Broadcast message to all viewers in room
            await self.broadcast_to_room(room_id, msg_payload)
            return

    async def broadcast_poll_created(self, room_id: str, poll_data: Dict[str, Any]):
        """Broadcast a newly created match poll to room viewers."""
        await self.broadcast_to_room(room_id, {
            "type": "poll_created",
            "poll": poll_data,
        })

    async def broadcast_poll_update(self, room_id: str, poll_data: Dict[str, Any]):
        """Broadcast updated poll vote results to room viewers."""
        await self.broadcast_to_room(room_id, {
            "type": "poll_updated",
            "poll": poll_data,
        })


# Global singleton instance for the app
chat_manager = ChatManager()
