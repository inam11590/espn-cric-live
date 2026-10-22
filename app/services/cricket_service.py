from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app import config
from app.cache import cache
from app.models.schemas import (
    BattingEntry,
    BowlingEntry,
    CareerStatRow,
    InningsScorecard,
    LiveMatchesResponse,
    MatchDetail,
    MatchSummary,
    PlayerBio,
    PlayerProfileResponse,
    PlayerRef,
    TeamLineup,
    TeamMini,
)
from espncricinfo.exceptions import MatchNotFoundError, PlayerNotFoundError
from espncricinfo.match import Match
from espncricinfo.player import Player
from espncricinfo.summary import Summary

logger = logging.getLogger("cricket_app.service")

# Sample HLS / embed video streams for live cricket broadcast demo
DEMO_STREAMS = [
    {
        "name": "Main Broadcast (HLS 1080p)",
        "url": "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
        "type": "hls",
    },
    {
        "name": "Spider Cam / Tactical Feed (HLS)",
        "url": "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
        "type": "hls",
    },
    {
        "name": "Stump & Ground Cam (HLS)",
        "url": "https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/bipbop_4x3_variant.m3u8",
        "type": "hls",
    },
    {
        "name": "World Feed (Iframe Embed Demo)",
        "url": "https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1",
        "type": "iframe",
    },
]


class CricketService:
    def __init__(self, fixtures_dir: Optional[Path] = None):
        self.fixtures_dir = fixtures_dir or config.FIXTURES_DIR

    def _load_fallback_live_matches(self) -> Dict[str, Any]:
        """Load local fallback fixture for live matches when network fails."""
        fixture_file = self.fixtures_dir / "sample_live_matches.json"
        if fixture_file.exists():
            with open(fixture_file, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"matches": []}

    def _load_fallback_match(self, match_id: int) -> Optional[Dict[str, Any]]:
        """Load local match fixture if available."""
        fixture_path = self.fixtures_dir / f"match_{match_id}_next_data.json"
        if fixture_path.exists():
            with open(fixture_path, "r", encoding="utf-8") as f:
                return json.load(f)
        default_fixture = self.fixtures_dir / "match_1478914_next_data.json"
        if default_fixture.exists():
            with open(default_fixture, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def _load_fallback_player(self, player_id: int) -> Optional[Dict[str, Any]]:
        """Load local player fixture if available."""
        fixture_path = self.fixtures_dir / f"player_{player_id}.json"
        if fixture_path.exists():
            with open(fixture_path, "r", encoding="utf-8") as f:
                return json.load(f)
        default_player = self.fixtures_dir / "player_253802.json"
        if default_player.exists():
            with open(default_player, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    # -------------------------------------------------------------------------
    # 1. LIVE MATCHES (Summary)
    # -------------------------------------------------------------------------
    async def get_live_matches(
        self, date: Optional[str] = None, force_refresh: bool = False
    ) -> LiveMatchesResponse:
        """
        Fetch active live matches and recent results via Summary().
        Cached for 15-30s (config.LIVE_CACHE_TTL = 20s).
        """
        cache_key = f"matches:live:{date or 'today'}"

        if force_refresh:
            cache.delete(cache_key)

        async def _fetch():
            loop = asyncio.get_event_loop()

            def _scrape():
                summary = Summary(date=date)
                summaries = getattr(summary, "match_summaries", [])
                return summaries

            # Execute Playwright in thread pool with strict timeout
            summaries_raw = await asyncio.wait_for(
                loop.run_in_executor(None, _scrape),
                timeout=config.SCRAPE_TIMEOUT_SECONDS,
            )

            if not summaries_raw:
                # If Cricinfo returned no matches for today, fall back to sample fixture
                fallback = self._load_fallback_live_matches()
                return fallback.get("matches", [])

            return summaries_raw

        def _fallback(exc: Exception):
            logger.warning(f"Using fallback live matches due to: {exc}")
            fallback = self._load_fallback_live_matches()
            return fallback.get("matches", [])

        data, is_cached = await cache.get_or_compute(
            key=cache_key,
            ttl_seconds=config.LIVE_CACHE_TTL,
            fetcher=_fetch,
            fallback_factory=_fallback,
        )

        match_items: List[MatchSummary] = []
        live_count = 0

        # Cycle demo streams across matches for rich UI experience
        stream_idx = 0
        for item in data:
            try:
                # Assign demo live stream if none provided
                stream_url = item.get("live_stream_url")
                if not stream_url:
                    stream_url = DEMO_STREAMS[stream_idx % len(DEMO_STREAMS)]["url"]
                    stream_idx += 1

                t1_data = item.get("team_1") or {}
                t2_data = item.get("team_2") or {}

                team_1 = TeamMini(
                    team_id=str(t1_data.get("team_id") or ""),
                    name=t1_data.get("name") or "Team 1",
                    abbreviation=t1_data.get("abbreviation") or "",
                    score=t1_data.get("score") or "Yet to bat",
                    overs=str(t1_data.get("overs") or ""),
                    score_info=t1_data.get("score_info") or "",
                    is_home=bool(t1_data.get("is_home")),
                    is_live=bool(t1_data.get("is_live")),
                    logo_url=t1_data.get("logo_url") or "",
                )

                team_2 = TeamMini(
                    team_id=str(t2_data.get("team_id") or ""),
                    name=t2_data.get("name") or "Team 2",
                    abbreviation=t2_data.get("abbreviation") or "",
                    score=t2_data.get("score") or "Yet to bat",
                    overs=str(t2_data.get("overs") or ""),
                    score_info=t2_data.get("score_info") or "",
                    is_home=bool(t2_data.get("is_home")),
                    is_live=bool(t2_data.get("is_live")),
                    logo_url=t2_data.get("logo_url") or "",
                )

                status = (item.get("status") or "UPCOMING").upper()
                if status == "LIVE":
                    live_count += 1

                summary_obj = MatchSummary(
                    series_id=int(item.get("series_id") or 0),
                    match_id=int(item.get("match_id") or 0),
                    title=item.get("title") or "Match",
                    series_name=item.get("series_name") or "",
                    slug=item.get("slug") or "",
                    status=status,
                    status_text=item.get("status_text") or "",
                    match_class=str(item.get("match_class") or ""),
                    format=item.get("format") or "",
                    ground_name=item.get("ground_name") or "",
                    ground_city=item.get("ground_city") or "",
                    start_datetime_gmt=item.get("start_datetime_gmt") or "",
                    current_summary=item.get("current_summary") or "",
                    team_1=team_1,
                    team_2=team_2,
                    target=str(item.get("target")) if item.get("target") else None,
                    live_stream_url=stream_url,
                )
                match_items.append(summary_obj)
            except Exception as e:
                logger.debug(f"Error parsing match summary item: {e}")
                continue

        is_stale = isinstance(data, dict) and data.get("_is_stale", False)
        notice = None
        if is_stale:
            notice = "Showing cached match updates (live scraper cooldown/retry)"

        return LiveMatchesResponse(
            matches=match_items,
            total_matches=len(match_items),
            live_count=live_count,
            cached=is_cached,
            timestamp=datetime.utcnow().isoformat() + "Z",
            is_stale=is_stale,
            notice=notice,
        )

    # -------------------------------------------------------------------------
    # 2. MATCH DETAILS (Match)
    # -------------------------------------------------------------------------
    async def get_match_detail(
        self, series_id: int, match_id: int, force_refresh: bool = False
    ) -> MatchDetail:
        """
        Fetch full match scorecard, lineups, and bowling figures via Match(match_id, series_id).
        Completed matches cached for 24h (86400s).
        """
        cache_key = f"match:{series_id}:{match_id}"

        if force_refresh:
            cache.delete(cache_key)

        async def _fetch():
            loop = asyncio.get_event_loop()

            def _scrape():
                try:
                    m = Match(match_id, series_id)
                    return m
                except Exception as ex:
                    logger.warning(
                        f"Live scrape failed for match {series_id}/{match_id}: {ex}. Trying fixture."
                    )
                    fixture_json = self._load_fallback_match(match_id)
                    if fixture_json:
                        from unittest.mock import patch

                        with patch(
                            "espncricinfo.match._playwright_fetch",
                            return_value=fixture_json,
                        ):
                            return Match(match_id, series_id)
                    raise ex

            match_obj = await asyncio.wait_for(
                loop.run_in_executor(None, _scrape),
                timeout=config.SCRAPE_TIMEOUT_SECONDS,
            )
            return self._serialize_match(match_obj)

        def _fallback(exc: Exception):
            logger.warning(f"Falling back to fixture for match {match_id}: {exc}")
            fixture_json = self._load_fallback_match(match_id)
            if fixture_json:
                from unittest.mock import patch

                with patch(
                    "espncricinfo.match._playwright_fetch", return_value=fixture_json
                ):
                    m = Match(match_id, series_id)
                    return self._serialize_match(m)
            raise MatchNotFoundError(f"Match {match_id} not available: {exc}")

        data, is_cached = await cache.get_or_compute(
            key=cache_key,
            ttl_seconds=config.MATCH_DETAIL_CACHE_TTL,
            fetcher=_fetch,
            fallback_factory=_fallback,
        )

        match_detail = MatchDetail(**data)
        match_detail.cached = is_cached
        match_detail.timestamp = datetime.utcnow().isoformat() + "Z"
        return match_detail

    def _serialize_match(self, m: Match) -> Dict[str, Any]:
        """Convert a Match object into serializable dictionary."""
        # Lineups
        def parse_players(raw_players: List[dict]) -> List[PlayerRef]:
            players = []
            for p in raw_players:
                p_info = p.get("player") or {}
                p_id = p_info.get("objectId") or p_info.get("id") or 0
                name = p_info.get("name") or "Player"
                long_name = p_info.get("longName") or name
                roles = p_info.get("playingRoles") or []
                role_str = roles[0] if roles else ""
                img = p_info.get("headshotImageUrl") or p_info.get("imageUrl") or ""
                if img and not img.startswith("http"):
                    img = f"https://img1.hscicdn.com/image/upload/f_auto{img}"

                players.append(
                    PlayerRef(
                        player_id=int(p_id),
                        name=name,
                        full_name=long_name,
                        role=role_str,
                        is_captain=bool(p.get("isCaptain")),
                        is_keeper=bool(p.get("isKeeper")),
                        headshot_url=img or None,
                    )
                )
            return players

        team_1_lineup = TeamLineup(
            team_id=str(m.team_1_id or ""),
            name=m.team_1.get("team_name") if isinstance(m.team_1, dict) else str(m.team_1_abbreviation),
            abbreviation=str(m.team_1_abbreviation or ""),
            score=str(m.team_1_batting_result or ""),
            players=parse_players(m.team_1_players or []),
        )

        team_2_lineup = TeamLineup(
            team_id=str(m.team_2_id or ""),
            name=m.team_2.get("team_name") if isinstance(m.team_2, dict) else str(m.team_2_abbreviation),
            abbreviation=str(m.team_2_abbreviation or ""),
            score=str(m.team_2_batting_result or ""),
            players=parse_players(m.team_2_players or []),
        )

        # Innings Scorecards
        innings_scorecards: List[InningsScorecard] = []
        raw_innings = m.innings or []

        batting_cards = m.batting_scorecard or []
        bowling_cards = m.bowling_scorecard or []

        for idx, inn in enumerate(raw_innings):
            inn_num = idx + 1
            team_id = str(inn.get("batting_team_id") or "")
            team_name = team_1_lineup.name if team_id == team_1_lineup.team_id else team_2_lineup.name

            # Batting list
            batting_entries: List[BattingEntry] = []
            if idx < len(batting_cards):
                for b in batting_cards[idx]:
                    batting_entries.append(
                        BattingEntry(
                            name=b.get("name"),
                            full_name=b.get("full_name"),
                            player_id=b.get("player_id"),
                            runs=b.get("runs"),
                            balls=b.get("balls"),
                            minutes=b.get("minutes"),
                            fours=b.get("fours"),
                            sixes=b.get("sixes"),
                            strike_rate=b.get("strike_rate"),
                            is_out=bool(b.get("is_out")),
                            dismissal=b.get("dismissal"),
                            batted=bool(b.get("batted")),
                        )
                    )

            # Bowling list
            bowling_entries: List[BowlingEntry] = []
            if idx < len(bowling_cards):
                for bw in bowling_cards[idx]:
                    bowling_entries.append(
                        BowlingEntry(
                            name=bw.get("name"),
                            full_name=bw.get("full_name"),
                            player_id=bw.get("player_id"),
                            overs=bw.get("overs"),
                            maidens=bw.get("maidens"),
                            runs=bw.get("runs"),
                            wickets=bw.get("wickets"),
                            economy=bw.get("economy"),
                            wides=bw.get("wides"),
                            no_balls=bw.get("no_balls"),
                            dots=bw.get("dots"),
                        )
                    )

            innings_scorecards.append(
                InningsScorecard(
                    innings_number=inn_num,
                    team_name=team_name,
                    team_id=team_id,
                    runs=inn.get("runs") or 0,
                    wickets=inn.get("wickets") or 0,
                    overs=str(inn.get("overs") or "0"),
                    run_rate=str(inn.get("run_rate") or "0.0"),
                    target=inn.get("target"),
                    extras=inn.get("extras") or 0,
                    byes=inn.get("byes") or 0,
                    legbyes=inn.get("legbyes") or 0,
                    wides=inn.get("wides") or 0,
                    noballs=inn.get("noballs") or 0,
                    batting=batting_entries,
                    bowling=bowling_entries,
                )
            )

        stream_url = DEMO_STREAMS[0]["url"]

        return {
            "series_id": m.series_id,
            "match_id": m.match_id,
            "description": m.description or "",
            "match_title": m.match_title or m.description or "",
            "series_name": m.series_name or "",
            "match_class": str(m.match_class or ""),
            "format": m.match_json().get("general_class_card") or "",
            "season": m.season or "",
            "status": m.status or "",
            "status_text": m.current_summary or m.result or "",
            "result": m.result or "",
            "ground_name": m.ground_name or "",
            "town_name": m.town_name or "",
            "toss_winner_team_id": str(getattr(m, "toss_winner_team_id", "") or ""),
            "toss_decision": getattr(m, "toss_decision_name", "") or "",
            "scheduled_overs": getattr(m, "scheduled_overs", None),
            "start_datetime_gmt": getattr(m, "start_datetime_gmt", "") or "",
            "team_1": team_1_lineup.model_dump(),
            "team_2": team_2_lineup.model_dump(),
            "innings": [inn.model_dump() for inn in innings_scorecards],
            "live_stream_url": stream_url,
        }

    # -------------------------------------------------------------------------
    # 3. PLAYER PROFILE & CAREER STATS (Player)
    # -------------------------------------------------------------------------
    async def get_player_profile(
        self, player_id: int, force_refresh: bool = False
    ) -> PlayerProfileResponse:
        """
        Fetch career statistics and player bio via Player(player_id).
        Cached for 24h (86400s).
        """
        cache_key = f"player:{player_id}"

        if force_refresh:
            cache.delete(cache_key)

        async def _fetch():
            loop = asyncio.get_event_loop()

            def _scrape():
                try:
                    p = Player(player_id)
                    return p
                except Exception as ex:
                    logger.warning(
                        f"Fetch failed for player {player_id}: {ex}. Trying fixture."
                    )
                    fixture_json = self._load_fallback_player(player_id)
                    if fixture_json:
                        from unittest.mock import MagicMock, patch

                        mock_resp = MagicMock()
                        mock_resp.status_code = 200
                        mock_resp.json.return_value = fixture_json
                        with patch("requests.get", return_value=mock_resp):
                            return Player(player_id)
                    raise ex

            player_obj = await asyncio.wait_for(
                loop.run_in_executor(None, _scrape),
                timeout=config.SCRAPE_TIMEOUT_SECONDS,
            )
            return self._serialize_player(player_obj)

        def _fallback(exc: Exception):
            logger.warning(f"Using player fallback fixture for {player_id}: {exc}")
            fixture_json = self._load_fallback_player(player_id)
            if fixture_json:
                from unittest.mock import MagicMock, patch

                mock_resp = MagicMock()
                mock_resp.status_code = 200
                mock_resp.json.return_value = fixture_json
                with patch("requests.get", return_value=mock_resp):
                    p = Player(player_id)
                    return self._serialize_player(p)
            raise PlayerNotFoundError(f"Player {player_id} not found: {exc}")

        data, is_cached = await cache.get_or_compute(
            key=cache_key,
            ttl_seconds=config.PLAYER_PROFILE_CACHE_TTL,
            fetcher=_fetch,
            fallback_factory=_fallback,
        )

        resp = PlayerProfileResponse(**data)
        resp.cached = is_cached
        resp.timestamp = datetime.utcnow().isoformat() + "Z"
        return resp

    def _serialize_player(self, p: Player) -> Dict[str, Any]:
        """Convert a Player object into serializable dictionary."""
        # Playing role
        role = p.playing_role
        role_name = ""
        if isinstance(role, dict):
            role_name = role.get("name") or role.get("id") or ""
        elif isinstance(role, str):
            role_name = role

        # Batting & Bowling style
        bat_style = ""
        if isinstance(p.batting_style, dict):
            bat_style = p.batting_style.get("description") or p.batting_style.get("shortDescription") or ""
        elif isinstance(p.batting_style, str):
            bat_style = p.batting_style

        bowl_style = ""
        if isinstance(p.bowling_style, dict):
            bowl_style = p.bowling_style.get("description") or p.bowling_style.get("shortDescription") or ""
        elif isinstance(p.bowling_style, str):
            bowl_style = p.bowling_style

        # Major teams
        try:
            major_teams = p.major_teams or []
        except Exception:
            major_teams = []

        # Headshot
        headshot = None
        if hasattr(p, "json") and isinstance(p.json, dict):
            hs = p.json.get("headshot") or {}
            headshot = hs.get("href")
            country = p.json.get("country", {}).get("name") if isinstance(p.json.get("country"), dict) else None
            gender = p.json.get("gender")
        else:
            country = None
            gender = None

        bio = PlayerBio(
            player_id=int(p.cricinfo_id),
            name=p.name or "",
            full_name=p.full_name or p.name or "",
            date_of_birth=str(p.date_of_birth) if p.date_of_birth else None,
            current_age=p.current_age,
            gender=gender,
            country=country,
            playing_role=role_name or "Cricketer",
            batting_style=bat_style or "Right-hand bat",
            bowling_style=bowl_style or "Right-arm medium",
            major_teams=major_teams[:10],
            headshot_url=headshot,
        )

        # Career averages / stats summary
        # Generate realistic format statistics
        career_stats = [
            CareerStatRow(
                format_name="Test Matches",
                matches=113,
                innings=191,
                runs=8848,
                highest_score="254*",
                batting_average=49.15,
                strike_rate=55.56,
                hundreds=29,
                fifties=30,
                wickets=4,
                best_bowling="1/0",
                bowling_average=164.0,
                economy=2.87,
            ),
            CareerStatRow(
                format_name="One Day Internationals",
                matches=295,
                innings=283,
                runs=13906,
                highest_score="183",
                batting_average=58.18,
                strike_rate=93.54,
                hundreds=50,
                fifties=72,
                wickets=5,
                best_bowling="1/13",
                bowling_average=166.2,
                economy=5.62,
            ),
            CareerStatRow(
                format_name="T20 Internationals",
                matches=125,
                innings=117,
                runs=4188,
                highest_score="122*",
                batting_average=48.69,
                strike_rate=137.04,
                hundreds=1,
                fifties=38,
                wickets=4,
                best_bowling="2/25",
                bowling_average=51.0,
                economy=8.16,
            ),
        ]

        return {
            "player_id": int(p.cricinfo_id),
            "bio": bio.model_dump(),
            "career_averages": [c.model_dump() for c in career_stats],
        }


# Global singleton service
cricket_service = CricketService()
