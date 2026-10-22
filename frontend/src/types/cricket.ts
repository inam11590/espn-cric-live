export type StreamType = 'hls' | 'proxy_hls' | 'iframe';

export interface StreamServer {
  id?: number;
  server_name: string;
  stream_type: StreamType;
  stream_url: string;
  quality: string;
  is_active: boolean;
  referer?: string;
}

export interface TeamMini {
  team_id: string;
  name: string;
  abbreviation: string;
  score: string;
  overs: string;
  score_info?: string;
  is_home?: boolean;
  is_live?: boolean;
  logo_url?: string;
}

export interface MatchSummary {
  series_id: number;
  match_id: number;
  title: string;
  series_name: string;
  slug?: string;
  status: string;
  status_text: string;
  match_class?: string;
  format?: string;
  ground_name?: string;
  ground_city?: string;
  start_datetime_gmt?: string;
  current_summary?: string;
  team_1: TeamMini;
  team_2: TeamMini;
  target?: string | null;
  live_stream_url?: string;
  streams: StreamServer[];
}

export interface BattingEntry {
  name: string;
  full_name?: string;
  player_id?: number;
  runs: number | null;
  balls: number | null;
  minutes?: number | null;
  fours: number | null;
  sixes: number | null;
  strike_rate: number | null;
  is_out: boolean;
  dismissal?: string;
  batted: boolean;
}

export interface BowlingEntry {
  name: string;
  full_name?: string;
  player_id?: number;
  overs: number | null;
  maidens: number | null;
  runs: number | null;
  wickets: number | null;
  economy: number | null;
  wides?: number | null;
  no_balls?: number | null;
  dots?: number | null;
}

export interface InningsScorecard {
  innings_number: number;
  team_name: string;
  team_id: string;
  runs: number;
  wickets: number;
  overs: string;
  run_rate: string;
  target?: number | null;
  extras?: number;
  byes?: number;
  legbyes?: number;
  wides?: number;
  noballs?: number;
  batting: BattingEntry[];
  bowling: BowlingEntry[];
}

export interface PlayerRef {
  player_id: number;
  name: string;
  full_name: string;
  role: string;
  is_captain?: boolean;
  is_keeper?: boolean;
  headshot_url?: string;
}

export interface TeamLineup {
  team_id: string;
  name: string;
  abbreviation: string;
  score?: string;
  players: PlayerRef[];
}

export interface MatchDetail {
  series_id: number;
  match_id: number;
  description: string;
  match_title: string;
  series_name: string;
  match_class: string;
  format: string;
  season?: string;
  status: string;
  status_text: string;
  result?: string;
  ground_name?: string;
  town_name?: string;
  toss_winner_team_id?: string;
  toss_decision?: string;
  scheduled_overs?: number;
  team_1: TeamLineup;
  team_2: TeamLineup;
  innings: InningsScorecard[];
  cached?: boolean;
  streams: StreamServer[];
}
