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

// ---------------------------------------------------------------------------
// API endpoints + response shapes (Phase 0). JSON Schemas generated from the
// backend Pydantic models live in contracts/schema/*.schema.json
// (regenerate: python backend/scripts/export_contracts.py).
// ---------------------------------------------------------------------------

export const API_ENDPOINTS = {
  health: "/health",
  games: "/games", // ?season=2023&week=&season_type=&limit=&offset=
  game: (gameId: string) => `/games/${encodeURIComponent(gameId)}`,
  plays: (gameId: string) => `/games/${encodeURIComponent(gameId)}/plays`, // ?limit=&offset=
  winProbability: (gameId: string) =>
    `/games/${encodeURIComponent(gameId)}/win-probability`, // ?swing_threshold=0.08
} as const;

/** Default swing-play threshold: |delta_home_wp| >= 0.08 (server-configurable). */
export const DEFAULT_SWING_WP_THRESHOLD = 0.08;

export interface HealthResponse {
  status: "ok" | "degraded";
  duckdb_path: string;
  store_ready: boolean;
  phase: number;
  scope: "historical_replay_only";
}

export interface GamesListResponse {
  items: GameSummary[];
  total: number;
  limit: number;
  offset: number;
  truth_label: "historical";
}

export type GameDetailResponse = GameSummary & { truth_label: "historical" };

export interface PlaysResponse {
  game_id: string;
  items: CanonicalPlay[];
  total: number;
  limit: number;
  offset: number;
  truth_label: "historical";
  reference_disclaimer: string;
}

export type GameResult = "home_win" | "away_win" | "tie";

/**
 * One point per play on the win-chance chart.
 * - Perspective: HOME team (`home_wp_*` = P(home wins)). Not possession team.
 * - `home_wp_pre`: before the snap. `home_wp_post`: next play's pre-snap value,
 *   or the final result on the last play (1 home win / 0 home loss / 0.5 tie).
 * - `is_swing`: |delta_home_wp| >= series.swing_threshold.
 * - Overtime: quarter 5, `is_overtime` true; `game_seconds_elapsed` keeps
 *   counting past 3600 (REG OT 600 s, POST OT 900 s) so the x-axis never rewinds.
 */
export interface WinProbabilityPoint {
  play_id: string;
  play_index: number;
  quarter: number;
  is_overtime: boolean;
  game_seconds_elapsed: number;
  possession_team_id?: string | null;
  description?: string | null;
  home_wp_pre: number;
  home_wp_post: number;
  delta_home_wp: number;
  is_swing: boolean;
}

export interface WinProbabilitySeries {
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score?: number | null;
  away_score?: number | null;
  result?: GameResult | null;
  perspective: "home";
  timing: "pre_snap";
  swing_threshold: number;
  source: "nflverse_reference_home_wp";
  truth_label: "historical";
  has_overtime: boolean;
  points: WinProbabilityPoint[];
  swing_play_ids: string[];
}
