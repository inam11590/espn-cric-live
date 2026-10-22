from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


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


class MatchSummary(BaseModel):
    series_id: int
    match_id: int
    title: str = ""
    series_name: str = ""
    slug: str = ""
    status: str = "UPCOMING"  # LIVE, RESULT, UPCOMING, ABANDONED
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


class LiveMatchesResponse(BaseModel):
    matches: List[MatchSummary] = []
    total_matches: int = 0
    live_count: int = 0
    cached: bool = False
    timestamp: str = ""
    is_stale: bool = False
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


class MatchDetail(BaseModel):
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
    is_stale: bool = False
    notice: Optional[str] = None


class CareerStatRow(BaseModel):
    format_name: str = ""  # Tests, ODIs, T20Is, etc.
    matches: Optional[int] = 0
    innings: Optional[int] = 0
    runs: Optional[int] = 0
    highest_score: Optional[str] = ""
    batting_average: Optional[float] = None
    strike_rate: Optional[float] = None
    hundreds: Optional[int] = 0
    fifties: Optional[int] = 0
    wickets: Optional[int] = 0
    best_bowling: Optional[str] = ""
    bowling_average: Optional[float] = None
    economy: Optional[float] = None


class PlayerBio(BaseModel):
    player_id: int
    name: str = ""
    full_name: str = ""
    date_of_birth: Optional[str] = None
    current_age: Optional[int] = None
    gender: Optional[str] = None
    country: Optional[str] = None
    playing_role: Optional[str] = None
    batting_style: Optional[str] = None
    bowling_style: Optional[str] = None
    major_teams: List[str] = []
    headshot_url: Optional[str] = None


class PlayerProfileResponse(BaseModel):
    player_id: int
    bio: PlayerBio
    career_averages: List[CareerStatRow] = []
    cached: bool = False
    timestamp: str = ""
    is_stale: bool = False
    notice: Optional[str] = None
