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
  series: WinProbabilitySeries;
  origin: "live" | "example";
  note: string;
};

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

function whyText(delta: number, p: WinProbabilityPoint, favored: string): string {
  const pts = Math.round(Math.abs(delta) * 100);
  const late = !p.is_overtime && REGULATION_SECONDS - p.game_seconds_elapsed <= 300;
  const d = (p.description ?? "").toLowerCase();
  let cause = "it changed field position and the score picture";
  if (/intercept|fumble/.test(d)) cause = "a turnover hands the ball and field position to the other side";
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
