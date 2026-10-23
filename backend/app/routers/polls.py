from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.core.database import get_db
from backend.app.core.security import get_current_admin
from backend.app.models.poll import MatchPoll, PollVote
from backend.app.models.schemas import (
    PollCreateRequest,
    PollDetailResponse,
    PollVoteRequest,
)
from backend.app.services.chat_manager import chat_manager

logger = logging.getLogger("cricket_app.routers.polls")

router = APIRouter(tags=["Polls"])


# -----------------------------------------------------------------------------
# Public Poll Endpoints
# -----------------------------------------------------------------------------

@router.get("/matches/{match_id}/polls", response_model=List[PollDetailResponse])
@router.get("/matches/{series_id}/{match_id}/polls", response_model=List[PollDetailResponse])
def get_match_polls(
    match_id: int,
    series_id: Optional[int] = None,
    session_id: Optional[str] = Query(None, description="Client session ID to check voted option"),
    db: Session = Depends(get_db),
):
    """
    Retrieve all active and recent prediction polls for a match.
    If session_id is provided, includes the user's previously voted option.
    """
    polls = (
        db.query(MatchPoll)
        .filter(MatchPoll.match_id == match_id)
        .order_by(MatchPoll.created_at.desc())
        .all()
    )

    results = []
    # Fetch user votes if session_id provided
    user_votes_map: Dict[int, str] = {}
    if session_id:
        poll_ids = [p.id for p in polls]
        if poll_ids:
            votes = (
                db.query(PollVote)
                .filter(PollVote.poll_id.in_(poll_ids), PollVote.session_id == session_id)
                .all()
            )
            for v in votes:
                user_votes_map[v.poll_id] = v.option_id

    for p in polls:
        p_dict = p.to_dict()
        p_dict["user_voted_option_id"] = user_votes_map.get(p.id)
        results.append(p_dict)

    return results


@router.post("/matches/{match_id}/polls/{poll_id}/vote", response_model=PollDetailResponse)
@router.post("/matches/{series_id}/{match_id}/polls/{poll_id}/vote", response_model=PollDetailResponse)
async def submit_poll_vote(
    match_id: int,
    poll_id: int,
    payload: PollVoteRequest,
    series_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """
    Submit a vote for a poll option.
    Enforces strict 1-vote-per-session guardrail.
    Broadcasts real-time vote percentage tallies to all WebSocket viewers.
    """
    poll = (
        db.query(MatchPoll)
        .filter(MatchPoll.id == poll_id, MatchPoll.match_id == match_id)
        .first()
    )
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Poll with ID {poll_id} not found for match {match_id}."
        )

    if not poll.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This poll has ended and is no longer accepting votes."
        )

    # Validate option_id exists in poll options
    options = poll.options or []
    valid_option_ids = {str(opt.get("id")) for opt in options}
    if str(payload.option_id) not in valid_option_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid option ID '{payload.option_id}'."
        )

    # Check if this session already voted
    existing_vote = (
        db.query(PollVote)
        .filter(PollVote.poll_id == poll_id, PollVote.session_id == payload.session_id)
        .first()
    )
    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already cast your vote on this poll."
        )

    # Record the vote
    new_vote = PollVote(
        poll_id=poll.id,
        session_id=payload.session_id,
        option_id=str(payload.option_id),
    )
    db.add(new_vote)

    # Update tallies in MatchPoll
    current_votes = dict(poll.votes or {})
    current_votes[str(payload.option_id)] = current_votes.get(str(payload.option_id), 0) + 1
    poll.votes = current_votes
    poll.total_votes = (poll.total_votes or 0) + 1

    db.commit()
    db.refresh(poll)

    res_dict = poll.to_dict()
    res_dict["user_voted_option_id"] = payload.option_id

    # Broadcast updated poll results to room viewers via WebSocket
    room_id = chat_manager.get_room_id(poll.series_id or 0, poll.match_id)
    await chat_manager.broadcast_poll_update(room_id, poll.to_dict())

    return res_dict


# -----------------------------------------------------------------------------
# Admin Poll Management Endpoints
# -----------------------------------------------------------------------------

@router.post("/admin/matches/{match_id}/polls", response_model=PollDetailResponse)
async def create_match_poll(
    match_id: int,
    payload: PollCreateRequest,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    Create a new live prediction poll for a match (Admin only).
    Broadcasts the new poll to all active match viewers in real time.
    """
    if not payload.question.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Poll question cannot be empty."
        )

    if len(payload.options) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A poll requires at least 2 options."
        )

    # Format options with IDs
    formatted_options = []
    initial_votes = {}
    for i, opt_text in enumerate(payload.options, start=1):
        opt_id = f"opt_{i}"
        formatted_options.append({"id": opt_id, "text": str(opt_text).strip()})
        initial_votes[opt_id] = 0

    new_poll = MatchPoll(
        match_id=match_id,
        series_id=payload.series_id,
        question=payload.question.strip(),
        options=formatted_options,
        votes=initial_votes,
        total_votes=0,
        is_active=True,
    )
    db.add(new_poll)
    db.commit()
    db.refresh(new_poll)

    poll_data = new_poll.to_dict()

    # Broadcast new poll to WebSocket room
    room_id = chat_manager.get_room_id(payload.series_id or 0, match_id)
    await chat_manager.broadcast_poll_created(room_id, poll_data)

    logger.info(f"Admin {admin_user} created poll #{new_poll.id} for match {match_id}: '{payload.question}'")
    return poll_data


@router.patch("/admin/polls/{poll_id}/toggle", response_model=PollDetailResponse)
async def toggle_poll_active(
    poll_id: int,
    db: Session = Depends(get_db),
    admin_user: str = Depends(get_current_admin),
):
    """
    Toggle poll active/closed state (Admin only).
    """
    poll = db.query(MatchPoll).filter(MatchPoll.id == poll_id).first()
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Poll #{poll_id} not found."
        )

    poll.is_active = not poll.is_active
    db.commit()
    db.refresh(poll)

    poll_data = poll.to_dict()

    # Broadcast updated poll to WebSocket room
    room_id = chat_manager.get_room_id(poll.series_id or 0, poll.match_id)
    await chat_manager.broadcast_poll_update(room_id, poll_data)

    logger.info(f"Admin {admin_user} toggled poll #{poll_id} active={poll.is_active}")
    return poll_data
