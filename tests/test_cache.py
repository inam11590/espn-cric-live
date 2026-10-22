import asyncio
import time
from app.cache import CricketCache


def test_cache_set_and_get():
    c = CricketCache()
    c.set("match:1", {"score": "200/4"}, ttl_seconds=2)
    assert c.get("match:1") == {"score": "200/4"}
    assert c.stats()["hits"] == 1


def test_cache_expiration():
    async def _test():
        c = CricketCache()
        c.set("live:1", "active", ttl_seconds=0.05)
        assert c.get("live:1") == "active"
        await asyncio.sleep(0.08)
        assert c.get("live:1") is None
        # Stale cache is still retrievable
        assert c.get_stale("live:1") == "active"

    asyncio.run(_test())


def test_cache_coalescing():
    async def _test():
        c = CricketCache()
        call_count = 0

        async def expensive_scraper():
            nonlocal call_count
            call_count += 1
            await asyncio.sleep(0.05)
            return {"data": 42}

        # Simulate 5 concurrent callers
        results = await asyncio.gather(
            c.get_or_compute("expensive", 5.0, expensive_scraper),
            c.get_or_compute("expensive", 5.0, expensive_scraper),
            c.get_or_compute("expensive", 5.0, expensive_scraper),
            c.get_or_compute("expensive", 5.0, expensive_scraper),
            c.get_or_compute("expensive", 5.0, expensive_scraper),
        )

        # Scraper was only called once thanks to in-flight lock!
        assert call_count == 1
        for r, is_cached in results:
            assert r == {"data": 42}

    asyncio.run(_test())


def test_cache_stale_on_error():
    async def _test():
        c = CricketCache()
        c.set("key1", {"status": "good"}, ttl_seconds=0.03)
        await asyncio.sleep(0.05)

        def failing_fetcher():
            raise ConnectionError("Akamai CDN block")

        data, was_cached = await c.get_or_compute("key1", 5.0, failing_fetcher)
        assert data["status"] == "good"
        assert data["_is_stale"] is True
        assert was_cached is True

    asyncio.run(_test())
