from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import LiveMatchesResponse, MatchDetail
from app.services.cricket_service import cricket_service
from espncricinfo.exceptions import MatchNotFoundError

router = APIRouter(prefix="/api/matches", tags=["Matches"])


@router.get("/live", response_model=LiveMatchesResponse)
async def get_live_matches(
    date: Optional[str] = Query(
        None,
        description="Filter by date in YYYY-MM-DD or DD-MM-YYYY format. Defaults to today.",
    ),
    refresh: bool = Query(
        False, description="Force refresh bypasses the 20-second cache."
    ),
):
    """
    Returns active live matches, scores, and status summaries via Summary().
    Scores and live summaries are cached for 15-30 seconds.
    """
    try:
        return await cricket_service.get_live_matches(date=date, force_refresh=refresh)
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch live matches: {exc}"
        )


@router.get("/{series_id}/{match_id}", response_model=MatchDetail)
async def get_match_detail(
    series_id: int,
    match_id: int,
    refresh: bool = Query(
        False, description="Force refresh bypasses the 24-hour cache."
    ),
):
    """
    Returns full match details, team line-ups, toss results, batting scorecards,
    and bowling figures via Match(match_id, series_id).
    Scorecards for finished matches are cached for 24 hours.
    """
    try:
        return await cricket_service.get_match_detail(
            series_id=series_id, match_id=match_id, force_refresh=refresh
        )
    except MatchNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch match scorecard: {exc}"
        )
