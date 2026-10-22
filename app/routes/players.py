from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import PlayerProfileResponse
from app.services.cricket_service import cricket_service
from espncricinfo.exceptions import PlayerNotFoundError

router = APIRouter(prefix="/api/players", tags=["Players"])


@router.get("/{player_id}", response_model=PlayerProfileResponse)
async def get_player_profile(
    player_id: int,
    refresh: bool = Query(
        False, description="Force refresh bypasses the 24-hour cache."
    ),
):
    """
    Returns career statistics and player bio via Player(player_id).
    Player profiles are cached for 24 hours.
    """
    try:
        return await cricket_service.get_player_profile(
            player_id=player_id, force_refresh=refresh
        )
    except PlayerNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail=f"Player ID {player_id} not found: {exc}"
        )
    except Exception as exc:
        raise HTTPException(
            status_code=500, detail=f"Failed to fetch player profile: {exc}"
        )
