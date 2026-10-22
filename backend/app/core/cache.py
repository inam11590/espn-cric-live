from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional, Tuple

logger = logging.getLogger("cricket_app.cache")


@dataclass
class CacheEntry:
    key: str
    value: Any
    created_at: float
    expires_at: float

    @property
    def is_expired(self) -> bool:
        return time.monotonic() > self.expires_at

    @property
    def age(self) -> float:
        return time.monotonic() - self.created_at

    @property
    def ttl_remaining(self) -> float:
        return max(0.0, self.expires_at - time.monotonic())


class ProductionCricketCache:
    """
    High-performance in-memory cache with non-blocking reads,
    per-key TTL, thundering-herd coalescing, and stale fallback.
    """

    def __init__(self):
        self._entries: Dict[str, CacheEntry] = {}
        self._locks: Dict[str, asyncio.Lock] = {}
        self._global_lock = asyncio.Lock()
        self._hits: int = 0
        self._misses: int = 0
        self._stale_hits: int = 0
        self._errors: int = 0

    async def _get_key_lock(self, key: str) -> asyncio.Lock:
        async with self._global_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    def get(self, key: str) -> Optional[Any]:
        """Fast non-blocking read from memory."""
        entry = self._entries.get(key)
        if entry is None or entry.is_expired:
            self._misses += 1
            return None
        self._hits += 1
        return entry.value

    def get_stale(self, key: str) -> Optional[Any]:
        """Return cached value even if expired (for fallback)."""
        entry = self._entries.get(key)
        if entry is not None:
            self._stale_hits += 1
            return entry.value
        return None

    def set(self, key: str, value: Any, ttl_seconds: float) -> None:
        """Store value with specified TTL."""
        now = time.monotonic()
        self._entries[key] = CacheEntry(
            key=key,
            value=value,
            created_at=now,
            expires_at=now + ttl_seconds,
        )

    def delete(self, key: str) -> bool:
        if key in self._entries:
            del self._entries[key]
            return True
        return False

    def clear(self) -> None:
        self._entries.clear()
        self._locks.clear()

    async def get_or_compute(
        self,
        key: str,
        ttl_seconds: float,
        fetcher: Callable[[], Any],
        fallback_factory: Optional[Callable[[Exception], Any]] = None,
    ) -> Tuple[Any, bool]:
        """
        Fast path: non-blocking memory read.
        Slow path: coalesce concurrent requests under single lock.
        """
        cached = self.get(key)
        if cached is not None:
            return cached, True

        key_lock = await self._get_key_lock(key)
        async with key_lock:
            cached = self.get(key)
            if cached is not None:
                return cached, True

            try:
                if asyncio.iscoroutinefunction(fetcher):
                    data = await fetcher()
                else:
                    data = fetcher()

                self.set(key, data, ttl_seconds)
                return data, False
            except Exception as exc:
                self._errors += 1
                logger.warning(f"Error fetching data for '{key}': {exc}")

                stale_data = self.get_stale(key)
                if stale_data is not None:
                    if isinstance(stale_data, dict):
                        stale_data["_is_stale"] = True
                        stale_data["_stale_reason"] = str(exc)
                    return stale_data, True

                if fallback_factory is not None:
                    fallback_data = fallback_factory(exc)
                    if isinstance(fallback_data, dict):
                        fallback_data["_is_fallback"] = True
                    self.set(key, fallback_data, ttl_seconds)
                    return fallback_data, False

                raise

    def stats(self) -> Dict[str, Any]:
        active_entries = [e for e in self._entries.values() if not e.is_expired]
        total_requests = self._hits + self._misses
        hit_ratio = round((self._hits / total_requests) * 100, 2) if total_requests > 0 else 0.0

        return {
            "total_keys": len(self._entries),
            "active_keys": len(active_entries),
            "hits": self._hits,
            "misses": self._misses,
            "stale_hits": self._stale_hits,
            "hit_ratio_percent": hit_ratio,
        }


cache = ProductionCricketCache()
