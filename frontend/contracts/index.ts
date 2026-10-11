/**
 * Shared TypeScript mirrors of Python Pydantic contracts (Phase 1).
 * snake_case to match FastAPI JSON. Types only — no outcome logic.
 */

export type League = "NFL";
export type TruthLabel = "historical" | "predicted" | "counterfactual";
export type DataMode = "historical" | "live" | "demo";
export type PlayType =
  | "pass"
  | "rush"
  | "punt"
  | "field_goal"
  | "kickoff"
  | "extra_point"
  | "two_point"
  | "no_play"
  | "other";

export interface Provenance {
  truth_label: TruthLabel;
  data_mode: DataMode;
  source_id: string;
  source_version: string;
  model_id?: string | null;
  model_version?: string | null;
  ruleset_id?: string;
  seed?: number | null;
  snapshot_id?: string | null;
  created_at: string;
  notes?: string[];
}

export interface GameSummary {
  game_id: string;
  league: League;
  season: number;
  week: number;
  season_type: string;
  game_type?: string | null;
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  roof?: string | null;
  surface?: string | null;
  stadium?: string | null;
  home_opening_kickoff?: number | null;
  home_score?: number | null;
  away_score?: number | null;
}

export interface GameSituation {
  game_id: string;
  play_id?: string | null;
  season: number;
  week: number;
  season_type?: string;
  possession_team_id: string;
  defense_team_id: string;
  home_team_id: string;
  away_team_id: string;
  is_home_possession: boolean;
  down: number;
  distance: number;
  yardline_100: number;
  quarter: number;
  half_seconds_remaining: number;
  game_seconds_remaining: number;
  score_differential: number;
  posteam_score: number;
  defteam_score: number;
  posteam_timeouts: number;
  defteam_timeouts: number;
  roof?: string | null;
  receive_2h_ko: number;
  reference_ep?: number | null;
  reference_wp?: number | null;
}

export interface ReferenceModelColumns {
  ep?: number | null;
  epa?: number | null;
  wp?: number | null;
  wpa?: number | null;
  vegas_wp?: number | null;
  vegas_wpa?: number | null;
  home_wp?: number | null;
  away_wp?: number | null;
  cp?: number | null;
  success?: number | null;
}

export interface CanonicalPlay {
  play_id: string;
  game_id: string;
  play_index: number;
  quarter: number;
  half_seconds_remaining?: number | null;
  game_seconds_remaining?: number | null;
  down?: number | null;
  distance?: number | null;
  yardline_100?: number | null;
  possession_team_id?: string | null;
  defense_team_id?: string | null;
  is_home_possession?: boolean | null;
  score_differential?: number | null;
  posteam_score?: number | null;
  defteam_score?: number | null;
  posteam_timeouts?: number | null;
  defteam_timeouts?: number | null;
  roof?: string | null;
  receive_2h_ko?: number | null;
  play_type: PlayType;
  description?: string | null;
  yards_gained?: number | null;
  score_differential_post?: number | null;
  posteam_score_post?: number | null;
  defteam_score_post?: number | null;
  fixed_drive?: number | null;
  fixed_drive_result?: string | null;
  is_scoring_play?: boolean;
  is_turnover?: boolean;
  reference?: ReferenceModelColumns;
}

export type SimulationScope = "play" | "drive" | "game";

export interface SimulationRequest {
  situation: GameSituation;
  scope?: SimulationScope;
  n_paths?: number;
  seed: number;
  forced_action?: string | null;
  model_id?: string;
  label?: TruthLabel;
}

export interface OutcomeBucket {
  key: string;
  count: number;
  share: number;
}

export interface SimulationResult {
  request: SimulationRequest;
  provenance: Provenance;
  summary: Record<string, number>;
  distributions: Record<string, OutcomeBucket[]>;
  sample_paths?: Record<string, unknown>[];
}
