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
  /** Fan-facing, <= 20 words, no clock/formation/jersey text. Show this on cards. */
  display_text: string;
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
  swings: SwingPlay[];
  overtime_plays: SwingPlay[];
  chart: SwingPlay[];
}
export const SWING_EXPORT = swingPlays as unknown as { games: Record<string, SwingGame> };

function elapsedOf(q: number, left: number): number {
  return q > 4 ? REGULATION_SECONDS + (600 - left) : q * 900 - left;
}

function build(g: SwingGame): ChartSeries {
  const points: (WinProbabilityPoint & { event?: string })[] = [];
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
      event: r.event,
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
