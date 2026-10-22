from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from backend.app.models.schemas import PlayerProfileSchema
from backend.app.services.cricket_service import cricket_service

logger = logging.getLogger("cricket_app.routers.players")

router = APIRouter(prefix="/players", tags=["Players"])


@router.get("/{player_id}", response_model=PlayerProfileSchema)
async def get_player_profile(player_id: int):
    """
    Returns player profile bio, batting/bowling styles, team affiliations,
    and career summary/averages. Cached for 24 hours.
    """
    try:
        profile = await cricket_service.get_player_profile(player_id=player_id)
        return profile
    except Exception as exc:
        logger.error(f"Error fetching player profile for {player_id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to fetch player profile: {exc}")
