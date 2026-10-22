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


class CricketCache:
    """
    Thread-safe and async-safe in-memory cache with:
    - Per-key TTL expiration
    - Thundering-herd coalescing (in-flight locks)
    - Stale-while-error fallback (graceful degradation)
    - Detailed cache diagnostics and metrics
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
        """Return cached value if present and not expired."""
        entry = self._entries.get(key)
        if entry is None:
            self._misses += 1
            return None

        if entry.is_expired:
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
        logger.debug(f"Cached '{key}' for {ttl_seconds}s")

    def delete(self, key: str) -> bool:
        """Remove an entry from cache."""
        if key in self._entries:
            del self._entries[key]
            return True
        return False

    def clear(self) -> None:
        """Purge all entries."""
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
        Fetch from cache or execute fetcher with in-flight lock to coalesce
        concurrent requests. Returns (data, is_cached).
        If fetcher fails, attempts to return stale cache or invokes fallback_factory.
        """
        # Fast path: check unexpired cache
        cached = self.get(key)
        if cached is not None:
            return cached, True

        # Acquire per-key lock to prevent thundering herd
        key_lock = await self._get_key_lock(key)
        async with key_lock:
            # Re-check cache after acquiring lock
            cached = self.get(key)
            if cached is not None:
                return cached, True

            logger.info(f"Cache miss for '{key}'. Executing compute/fetch...")
            try:
                # If fetcher is coroutine or async function, await it
                if asyncio.iscoroutinefunction(fetcher):
                    data = await fetcher()
                else:
                    data = fetcher()

                # If successful, cache and return
                self.set(key, data, ttl_seconds)
                return data, False

            except Exception as exc:
                self._errors += 1
                logger.warning(f"Error fetching data for '{key}': {exc}")

                # Stale cache fallback
                stale_data = self.get_stale(key)
                if stale_data is not None:
                    logger.info(f"Returning stale cache for '{key}' due to error")
                    if isinstance(stale_data, dict):
                        stale_data["_is_stale"] = True
                        stale_data["_stale_reason"] = str(exc)
                    return stale_data, True

                # Custom fallback factory
                if fallback_factory is not None:
                    logger.info(f"Using fallback factory for '{key}'")
                    fallback_data = fallback_factory(exc)
                    if isinstance(fallback_data, dict):
                        fallback_data["_is_fallback"] = True
                        fallback_data["_error_details"] = str(exc)
                    # Cache the fallback data so subsequent requests are served from cache
                    self.set(key, fallback_data, ttl_seconds)
                    return fallback_data, False

                # If no fallback possible, re-raise
                raise

    def stats(self) -> Dict[str, Any]:
        """Return statistics on cache performance."""
        now = time.monotonic()
        active_entries = [e for e in self._entries.values() if not e.is_expired]
        expired_entries = [e for e in self._entries.values() if e.is_expired]
        total_requests = self._hits + self._misses
        hit_ratio = round((self._hits / total_requests) * 100, 2) if total_requests > 0 else 0.0

        return {
            "total_keys": len(self._entries),
            "active_keys": len(active_entries),
            "expired_keys": len(expired_entries),
            "hits": self._hits,
            "misses": self._misses,
            "stale_hits": self._stale_hits,
            "errors": self._errors,
            "hit_ratio_percent": hit_ratio,
            "keys": [
                {
                    "key": k,
                    "is_expired": v.is_expired,
                    "age_seconds": round(v.age, 1),
                    "ttl_remaining_seconds": round(v.ttl_remaining, 1),
                }
                for k, v in self._entries.items()
            ],
        }


# Global singleton cache
cache = CricketCache()
