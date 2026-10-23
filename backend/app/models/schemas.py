from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


# -----------------------------------------------------------------------------
# Video Streaming Schemas
# -----------------------------------------------------------------------------

class StreamServerSchema(BaseModel):
    id: Optional[int] = None
    server_name: str = "HD Server 1"
    stream_type: str = "hls"  # "hls", "proxy_hls", or "iframe"
    stream_url: str
    referer: Optional[str] = None
    user_agent: Optional[str] = None
    quality: str = "1080p"  # "1080p", "720p", "480p", "Auto"
    is_active: bool = True
    priority_order: int = 0

    model_config = {"from_attributes": True}


class StreamServerCreate(BaseModel):
    server_name: str = "Main HD Feed"
    stream_type: str = "hls"  # "hls", "proxy_hls", or "iframe"
    stream_url: str
    referer: Optional[str] = None
    user_agent: Optional[str] = None
    quality: str = "1080p"
    is_active: bool = True
    priority_order: int = 0


class StreamServerUpdate(BaseModel):
    server_name: Optional[str] = None
    stream_type: Optional[str] = None
    stream_url: Optional[str] = None
    referer: Optional[str] = None
    user_agent: Optional[str] = None
    quality: Optional[str] = None
    is_active: Optional[bool] = None
    priority_order: Optional[int] = None


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str


class StreamTestRequest(BaseModel):
    stream_url: str
    referer: Optional[str] = None
    use_proxy: bool = False


class StreamTestResponse(BaseModel):
    success: bool
    status_code: int
    latency_ms: float
    content_type: Optional[str] = None
    is_valid_hls: bool = False
    message: str = ""


class CustomMatchCreate(BaseModel):
    match_id: int
    series_id: int
    match_title: str
    team_1_name: str
    team_2_name: str
    series_name: str = "Exhibition Series"
    status: str = "LIVE"
    status_text: str = "Live Stream Broadcast"



class MatchStreamCreate(BaseModel):
    match_id: int
    series_id: int
    match_title: Optional[str] = None
    is_live: bool = True
    servers: List[StreamServerSchema] = []


class MatchStreamResponse(BaseModel):
    id: int
    match_id: int
    series_id: int
    match_title: Optional[str]
    is_live: bool
    streams: List[StreamServerSchema] = []

    model_config = {"from_attributes": True}


# -----------------------------------------------------------------------------
# Cricket Scorecard Schemas
# -----------------------------------------------------------------------------

class TeamMini(BaseModel):
    team_id: str = ""
    name: str = ""
    abbreviation: str = ""
    score: str = ""
    overs: str = ""
    score_info: str = ""
    is_home: bool = False
    is_live: bool = False
    logo_url: str = ""


class MatchSummarySchema(BaseModel):
    series_id: int
    match_id: int
    title: str = ""
    series_name: str = ""
    slug: str = ""
    status: str = "UPCOMING"
    status_text: str = ""
    match_class: str = ""
    format: str = ""
    ground_name: str = ""
    ground_city: str = ""
    start_datetime_gmt: str = ""
    current_summary: str = ""
    team_1: TeamMini = Field(default_factory=TeamMini)
    team_2: TeamMini = Field(default_factory=TeamMini)
    target: Optional[str] = None
    live_stream_url: Optional[str] = ""
    # Enriched from database
    streams: List[StreamServerSchema] = []


class LiveMatchesResponse(BaseModel):
    matches: List[MatchSummarySchema] = []
    total_matches: int = 0
    live_count: int = 0
    cached: bool = True
    timestamp: str = ""
    is_stale: bool = False
    last_scraped_at: Optional[str] = None
    notice: Optional[str] = None


class BattingEntry(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    player_id: Optional[int] = None
    runs: Optional[int] = None
    balls: Optional[int] = None
    minutes: Optional[int] = None
    fours: Optional[int] = None
    sixes: Optional[int] = None
    strike_rate: Optional[float] = None
    is_out: bool = False
    dismissal: Optional[str] = None
    batted: bool = True


class BowlingEntry(BaseModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    player_id: Optional[int] = None
    overs: Optional[float] = None
    maidens: Optional[int] = None
    runs: Optional[int] = None
    wickets: Optional[int] = None
    economy: Optional[float] = None
    wides: Optional[int] = None
    no_balls: Optional[int] = None
    dots: Optional[int] = None


class InningsScorecard(BaseModel):
    innings_number: int
    team_name: str = ""
    team_id: str = ""
    runs: Optional[int] = 0
    wickets: Optional[int] = 0
    overs: Optional[str] = "0"
    run_rate: Optional[str] = "0.0"
    target: Optional[int] = None
    extras: Optional[int] = 0
    byes: Optional[int] = 0
    legbyes: Optional[int] = 0
    wides: Optional[int] = 0
    noballs: Optional[int] = 0
    batting: List[BattingEntry] = []
    bowling: List[BowlingEntry] = []


class PlayerRef(BaseModel):
    player_id: int
    name: str = ""
    full_name: str = ""
    role: str = ""
    is_captain: bool = False
    is_keeper: bool = False
    headshot_url: Optional[str] = None


class TeamLineup(BaseModel):
    team_id: str = ""
    name: str = ""
    abbreviation: str = ""
    score: str = ""
    players: List[PlayerRef] = []


class MatchDetailSchema(BaseModel):
    series_id: int
    match_id: int
    description: str = ""
    match_title: str = ""
    series_name: str = ""
    match_class: str = ""
    format: str = ""
    season: str = ""
    status: str = ""
    status_text: str = ""
    result: str = ""
    ground_name: str = ""
    town_name: str = ""
    toss_winner_team_id: str = ""
    toss_decision: str = ""
    scheduled_overs: Optional[int] = None
    start_datetime_gmt: str = ""
    team_1: TeamLineup = Field(default_factory=TeamLineup)
    team_2: TeamLineup = Field(default_factory=TeamLineup)
    innings: List[InningsScorecard] = []
    cached: bool = False
    timestamp: str = ""
    live_stream_url: Optional[str] = ""
    streams: List[StreamServerSchema] = []
    is_stale: bool = False
    notice: Optional[str] = None


# -----------------------------------------------------------------------------
# Player Schemas
# -----------------------------------------------------------------------------

class PlayerProfileSchema(BaseModel):
    player_id: int
    name: str = ""
    full_name: str = ""
    first_name: str = ""
    date_of_birth: Optional[str] = None
    current_age: Optional[str] = None
    playing_role: Optional[str] = None
    batting_style: Optional[str] = None
    bowling_style: Optional[str] = None
    major_teams: List[str] = []
    career_summary: Optional[Dict[str, Any]] = None
    career_averages: Optional[Dict[str, Any]] = None
    headshot_url: Optional[str] = None
    cached: bool = True


# -----------------------------------------------------------------------------
# System & Health Schemas
# -----------------------------------------------------------------------------

class HealthResponse(BaseModel):
    status: str = "healthy"
    version: str = "1.0.0"
    database: str = "connected"
    playwright: str = "ready"
    background_scheduler: str = "running"
    cached_matches_count: int = 0
    last_scheduler_run: Optional[str] = None


# -----------------------------------------------------------------------------
# Live Chat & Prediction Poll Schemas
# -----------------------------------------------------------------------------

class PollOptionInput(BaseModel):
    id: Optional[str] = None
    text: str


class PollCreateRequest(BaseModel):
    question: str
    options: List[str]  # e.g. ["India", "Australia"] or strings
    series_id: Optional[int] = None


class PollVoteRequest(BaseModel):
    option_id: str
    session_id: str


class PollOptionResult(BaseModel):
    id: str
    text: str
    votes: int = 0
    percentage: float = 0.0


class PollDetailResponse(BaseModel):
    id: int
    match_id: int
    series_id: Optional[int] = None
    question: str
    options: List[PollOptionResult]
    total_votes: int = 0
    is_active: bool = True
    created_at: Optional[str] = None
    user_voted_option_id: Optional[str] = None


class ChatMessagePayload(BaseModel):
    id: str
    user_id: str
    username: str
    avatar_color: Optional[str] = None
    message: str
    timestamp: str
    badge: Optional[str] = None

