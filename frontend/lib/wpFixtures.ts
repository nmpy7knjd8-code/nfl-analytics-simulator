/**
 * Win-probability series for the fixture game pages, built from REAL nflverse 2023 pbp rows
 * exported by backend/scripts/build_swing_examples.py into ./swingPlays.json (QA H5/M9).
 * Every play's quarter, clock, description and play_id is a real nflverse row; WP values are
 * nflverse's home_wp / home_wp_post (not our model). Contract shape: frontend/contracts/README.md.
 */
import swingPlays from "./swingPlays.json";
import { GAME_SOURCE_LINE } from "./fixtures";
import {
  DEFAULT_SWING_WP_THRESHOLD,
  REGULATION_SECONDS,
  isSwing,
  splitAtRegulation,
  type ChartSeries,
  type WinProbabilityPoint,
  type EventPoint,
  type WinProbabilitySeries,
} from "./winProbability";

export interface SwingPlay {
  game_id: string;
  play_id: string;
  qtr: number;
  clock: string;
  clock_seconds: number;
  description: string;
  play_type: string;
  possession_team_id: string | null;
  home_score_after: number;
  away_score_after: number;
  home_score_before: number;
  away_score_before: number;
  down: number | null;
  /** ydstogo */
  distance: number | null;
  yardline_100: number | null;
  event: SwingEvent;
  /** down == 4 and nflverse fourth_down_failed == 1 (go-for-it that failed). */
  fourth_down_failed: boolean;
  /** nflverse yards_gained (null when nflverse has none). */
  yards_gained: number | null;
  /** Interception or fumble returned for a TD by the defense. */
  return_td: boolean;
  /** Fan-facing, <= 20 words, no clock/formation/jersey text. Show this on cards. */
  display_text: string;
  /** Penalty sentence(s) after the play; null on "No play" rows (the flag is display_text) and flag-free plays. */
  penalty_text: string | null;
  /** Original nflverse desc, verbatim (same as `description`); for a "Play-by-play text" disclosure. */
  raw_desc: string;
  home_wp_pre?: number;
  home_wp_post?: number;
  delta_home_wp?: number;
  swing_eligible?: boolean;
}
export type SwingEvent =
  | "turnover_on_downs" | "interception" | "fumble_lost" | "touchdown" | "field_goal" | "punt" | "other";
/** frontend/lib/plays/<game_id>.json: every real play (incl. penalties), no timeouts/quarter markers. */
export interface GamePlayList {
  game_id: string;
  plays: SwingPlay[];
}
export interface SwingGame {
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  first_home_wp: number;
  /** nflverse pre-snap home_wp of the first real play (opening kickoff); away = 1 - home. */
  opening_home_wp: number;
  opening_away_wp: number;
  swings: SwingPlay[];
  overtime_plays: SwingPlay[];
  chart: SwingPlay[];
}
export const SWING_EXPORT = swingPlays as unknown as { games: Record<string, SwingGame> };

function elapsedOf(q: number, left: number): number {
  return q > 4 ? REGULATION_SECONDS + (600 - left) : q * 900 - left;
}

/** Fan fields from #86/#88, verbatim from the export (no rewrites here). */
function fanFields(r: SwingPlay) {
  return {
    event: r.event,
    fourth_down_failed: r.fourth_down_failed,
    display_text: r.display_text,
    raw_desc: r.raw_desc,
    down: r.down,
    distance: r.distance,
    yardline_100: r.yardline_100,
    home_score_before: r.home_score_before,
    away_score_before: r.away_score_before,
    yards_gained: r.yards_gained,
    return_td: r.return_td,
  };
}

/** Opening win chance from #88's opening_home_wp/opening_away_wp (not the flat 56.68% prior). */
export function openingWinChance(gameId: string): { home: number; away: number } | null {
  const g = SWING_EXPORT.games[gameId];
  if (!g || g.opening_home_wp == null || g.opening_away_wp == null) return null;
  return { home: g.opening_home_wp, away: g.opening_away_wp };
}

function build(g: SwingGame): ChartSeries {
  const points: EventPoint[] = [];
  let pre = g.first_home_wp;
  for (const r of g.chart) {
    const post = r.home_wp_post!;
    const delta = post - pre;
    points.push({
      play_id: r.play_id,
      play_index: points.length + 1,
      quarter: r.qtr,
      is_overtime: false,
      game_seconds_elapsed: elapsedOf(r.qtr, r.clock_seconds),
      possession_team_id: r.possession_team_id,
      description: r.description,
      ...fanFields(r),
      home_wp_pre: pre,
      home_wp_post: post,
      delta_home_wp: delta,
      // Shared swing filter: only regulation runs/passes/FGs/punts (no kneels or non-plays) can swing.
      is_swing: !!r.swing_eligible && isSwing({ delta_home_wp: delta }),
    });
    pre = post;
  }
  for (const r of g.overtime_plays) {
    // Overtime: no win chance (house rule); splitAtRegulation moves these to the OT play list.
    points.push({
      play_id: r.play_id,
      play_index: points.length + 1,
      quarter: r.qtr,
      is_overtime: true,
      game_seconds_elapsed: elapsedOf(r.qtr, r.clock_seconds),
      possession_team_id: r.possession_team_id,
      description: r.description,
      ...fanFields(r),
      home_wp_pre: pre,
      home_wp_post: pre,
      delta_home_wp: 0,
      is_swing: false,
    });
  }
  const result = g.home_score > g.away_score ? "home_win" : g.home_score < g.away_score ? "away_win" : "tie";
  const series: WinProbabilitySeries = {
    game_id: g.game_id,
    home_team_id: g.home_team_id,
    away_team_id: g.away_team_id,
    home_score: g.home_score,
    away_score: g.away_score,
    result,
    perspective: "home",
    timing: "pre_snap",
    swing_threshold: DEFAULT_SWING_WP_THRESHOLD,
    source: "nflverse_reference_home_wp",
    truth_label: "historical",
    has_overtime: g.overtime_plays.length > 0,
    points,
    swing_play_ids: points.filter((p) => p.is_swing).map((p) => p.play_id),
  };
  return {
    ...splitAtRegulation(series),
    origin: "example",
    note: GAME_SOURCE_LINE,
  };
}

export const WP_FIXTURES: Record<string, ChartSeries> = Object.fromEntries(
  Object.values(SWING_EXPORT.games).map((g) => [g.game_id, build(g)]),
);

export function fixtureWinProbability(gameId: string): ChartSeries | null {
  return WP_FIXTURES[gameId] ?? null;
}
