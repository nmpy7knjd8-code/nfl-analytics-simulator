/**
 * Win-probability helpers for Game Explorer charts, built on the shared contract
 * (frontend/contracts, PR #39): GET /games/{id}/win-probability → WinProbabilitySeries.
 *
 * Conventions (from the contract):
 *  - home_wp_pre / home_wp_post = P(home team wins). Never chart CanonicalPlay.reference.wp
 *    (that is the possession team's WP).
 *  - home_wp_pre is before the snap; home_wp_post is the next play's pre-snap value, or the
 *    final result (1 / 0 / 0.5) on the last play.
 *  - Swing plays: use the backend's is_swing flags when present; otherwise fall back to
 *    |delta_home_wp| >= DEFAULT_SWING_WP_THRESHOLD (0.08).
 *  - game_seconds_elapsed keeps counting past 3600 in overtime (is_overtime / has_overtime).
 */
import {
  DEFAULT_SWING_WP_THRESHOLD,
  type WinProbabilityPoint,
  type WinProbabilitySeries,
} from "../contracts";

export { DEFAULT_SWING_WP_THRESHOLD };
export type { WinProbabilityPoint, WinProbabilitySeries };

/** Where a series came from. The contract has no "example" source, so we carry it alongside. */
export type ChartSeries = {
  /** Regulation only (house rule: no overtime win chance anywhere). has_overtime still says whether OT was played. */
  series: WinProbabilitySeries;
  origin: "live" | "example";
  note: string;
  /** Overtime plays, kept for the play list, with no win-chance values. */
  overtimePlays: OvertimePlay[];
};

export type OvertimePlay = Pick<
  WinProbabilityPoint,
  "play_id" | "play_index" | "quarter" | "is_overtime" | "game_seconds_elapsed" | "possession_team_id" | "description"
>;

/**
 * House rule (creative-builds.md): win chance stops at the end of regulation.
 * Drops OT points (and their swing ids) from the series and returns the OT plays without
 * any win-chance fields, so callers can still list them.
 */
export function splitAtRegulation(series: WinProbabilitySeries): {
  series: WinProbabilitySeries;
  overtimePlays: OvertimePlay[];
} {
  const isOt = (p: WinProbabilityPoint) => p.is_overtime || p.quarter > 4;
  const regulation = series.points.filter((p) => !isOt(p));
  const overtimePlays = series.points.filter(isOt).map((p) => ({
    play_id: p.play_id,
    play_index: p.play_index,
    quarter: p.quarter,
    is_overtime: true,
    game_seconds_elapsed: p.game_seconds_elapsed,
    possession_team_id: p.possession_team_id,
    description: p.description,
  }));
  const kept = new Set(regulation.map((p) => p.play_id));
  return {
    series: {
      ...series,
      has_overtime: series.has_overtime || overtimePlays.length > 0,
      points: regulation,
      swing_play_ids: series.swing_play_ids.filter((id) => kept.has(id)),
    },
    overtimePlays,
  };
}

export interface SwingPlay {
  point: WinProbabilityPoint;
  /** delta_home_wp for this play (−1..1). */
  delta: number;
  favored_team_id: string;
  why: string;
}

export const REGULATION_SECONDS = 3600;
const QUARTER_SECONDS = 900;
const REG_OT_SECONDS = 600;

/** Backend flag when it is a boolean; else the threshold fallback. */
export function isSwing(
  p: Pick<WinProbabilityPoint, "delta_home_wp"> & { is_swing?: boolean | null },
  threshold = DEFAULT_SWING_WP_THRESHOLD,
): boolean {
  return typeof p.is_swing === "boolean" ? p.is_swing : Math.abs(p.delta_home_wp) >= threshold;
}

/** Fan fields carried on fixture points from lib/swingPlays.json (#86/#88). All optional: API points lack them. */
export type EventPoint = WinProbabilityPoint & {
  event?: string;
  fourth_down_failed?: boolean;
  display_text?: string;
  raw_desc?: string;
  down?: number | null;
  distance?: number | null;
  yardline_100?: number | null;
  home_score_before?: number;
  away_score_before?: number;
};

/** "4th & 7 · KC 35 · DET 14–13 KC" (UI Critic 2110 P1-B). Null when the situation fields are absent. */
export function situationLine(p: EventPoint, home: string, away: string): string | null {
  const parts: string[] = [];
  const ord = ["", "1st", "2nd", "3rd", "4th"];
  if (p.down && p.distance != null) parts.push(`${ord[p.down]} & ${p.distance}`);
  const pos = p.possession_team_id;
  if (p.yardline_100 != null && pos) {
    const opp = pos === home ? away : home;
    const y = p.yardline_100;
    parts.push(y === 50 ? "midfield" : y > 50 ? `${pos} ${100 - y}` : `${opp} ${y}`);
  }
  if (p.home_score_before != null && p.away_score_before != null)
    parts.push(`${away} ${p.away_score_before}–${p.home_score_before} ${home}`);
  return parts.length ? parts.join(" · ") : null;
}

function whyText(delta: number, p: EventPoint, favored: string): string {
  const pts = Math.round(Math.abs(delta) * 100);
  const late = !p.is_overtime && REGULATION_SECONDS - p.game_seconds_elapsed <= 300;
  const d = (p.description ?? "").toLowerCase();
  let cause = "it changed field position and the score picture";
  // QA M10 / UI P1-B: the event tag from nflverse (#86) decides the cause before any text match.
  if (p.fourth_down_failed || p.event === "turnover_on_downs") cause = "a failed fourth down hands the ball over";
  else if (p.event === "interception" || p.event === "fumble_lost") cause = "a turnover hands the ball and field position to the other side";
  else if (p.event === "touchdown") cause = "a touchdown changes the score in one snap";
  else if (p.event === "field_goal") cause = "points went on the board";
  else if (p.event === "punt") cause = "a punt flips field position";
  else if (p.event === "other") cause = /sack/.test(d) ? "a sack loses yards and can kill a drive" : "it moved the ball and the clock";
  else if (/intercept|fumble/.test(d)) cause = "a turnover hands the ball and field position to the other side";
  else if (/touchdown/.test(d)) cause = "a touchdown changes the score in one snap";
  else if (/field goal|fg/.test(d)) cause = "points went on the board";
  else if (/fourth-and|fourth down|4th/.test(d)) cause = "a fourth-down call decides who keeps the ball";
  else if (/sack/.test(d)) cause = "a sack loses yards and can kill a drive";
  return `${favored} gained ${pts} points of win chance because ${cause}${
    late || p.is_overtime ? ", and with little time left there is less chance to answer" : ""
  }.`;
}

/** Clock label from game_seconds_elapsed: "Q3 12:05" or "OT 7:32" (regular-season OT). */
export function clockLabel(p: Pick<WinProbabilityPoint, "quarter" | "is_overtime" | "game_seconds_elapsed">): string {
  const fmt = (t: number) => `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`;
  if (p.is_overtime) {
    return `OT ${fmt(Math.max(0, REG_OT_SECONDS - (p.game_seconds_elapsed - REGULATION_SECONDS)))}`;
  }
  const left = p.quarter * QUARTER_SECONDS - p.game_seconds_elapsed;
  return `Q${p.quarter} ${fmt(Math.max(0, Math.min(QUARTER_SECONDS, left)))}`;
}

/** Swing plays, largest first, capped at `limit`. */
export function findSwingPlays(
  series: WinProbabilitySeries,
  limit = 3,
  threshold = series.swing_threshold ?? DEFAULT_SWING_WP_THRESHOLD,
): SwingPlay[] {
  return series.points
    .filter((p) => isSwing(p, threshold))
    .map((p) => {
      const favored = p.delta_home_wp > 0 ? series.home_team_id : series.away_team_id;
      return { point: p, delta: p.delta_home_wp, favored_team_id: favored, why: whyText(p.delta_home_wp, p, favored) };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit);
}
