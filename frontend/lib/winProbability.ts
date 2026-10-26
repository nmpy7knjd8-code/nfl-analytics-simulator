/**
 * Win-probability series for Game Explorer charts.
 *
 * Frontend-local view model. NOT a shared contract: frontend/contracts does not yet
 * publish a WP-series shape (owned by NFL Data & Models, Phase 0). When it lands,
 * replace `WinProbabilitySeries` with the contract type and keep the adapters below.
 *
 * Convention: `home_wp` is the HOME team's chance to win after the play, in [0, 1].
 */
import type { CanonicalPlay } from "../contracts";

export interface WinProbabilityPoint {
  play_id: string;
  play_index: number;
  quarter: number;
  /** Seconds left in regulation, 3600 → 0. */
  game_seconds_remaining: number;
  home_wp: number;
  possession_team_id?: string | null;
  description?: string | null;
}

export interface WinProbabilitySeries {
  game_id: string;
  home_team_id: string;
  away_team_id: string;
  points: WinProbabilityPoint[];
  /** "example" = hand-made fixture, never real model output. */
  source: "example" | "reference" | "model";
  source_note: string;
}

export interface SwingPlay {
  point: WinProbabilityPoint;
  /** Change in home win chance caused by this play (−1..1). */
  delta: number;
  favored_team_id: string;
  why: string;
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/**
 * Build a series from CanonicalPlay reference columns (contract-shaped data).
 * Uses reference.home_wp when present, else converts possession-team `wp`.
 * Plays without a usable WP or clock are skipped, never invented.
 */
export function seriesFromPlays(
  game_id: string,
  home_team_id: string,
  away_team_id: string,
  plays: CanonicalPlay[],
): WinProbabilitySeries {
  const points: WinProbabilityPoint[] = [];
  for (const p of plays) {
    const r = p.reference;
    let home: number | null = r?.home_wp ?? null;
    if (home == null && r?.wp != null && p.possession_team_id) {
      home = p.possession_team_id === home_team_id ? r.wp : 1 - r.wp;
    }
    const secs =
      p.game_seconds_remaining ??
      (p.half_seconds_remaining != null && p.quarter <= 4
        ? p.half_seconds_remaining + (p.quarter <= 2 ? 1800 : 0)
        : null);
    if (home == null || secs == null || Number.isNaN(home)) continue;
    points.push({
      play_id: p.play_id,
      play_index: p.play_index,
      quarter: p.quarter,
      game_seconds_remaining: secs,
      home_wp: clamp01(home),
      possession_team_id: p.possession_team_id,
      description: p.description,
    });
  }
  return {
    game_id,
    home_team_id,
    away_team_id,
    points,
    source: "reference",
    source_note: "Reference win chance from play-by-play columns.",
  };
}

function whyText(delta: number, p: WinProbabilityPoint, favored: string): string {
  const pts = Math.round(Math.abs(delta) * 100);
  const late = p.game_seconds_remaining <= 300;
  const d = (p.description ?? "").toLowerCase();
  let cause = "it changed field position and the score picture";
  if (/intercept|fumble/.test(d)) cause = "a turnover hands the ball and field position to the other side";
  else if (/touchdown/.test(d)) cause = "a touchdown changes the score in one snap";
  else if (/field goal|fg/.test(d)) cause = "points went on the board";
  else if (/fourth-and|4th/.test(d)) cause = "a fourth-down call decides who keeps the ball";
  else if (/sack/.test(d)) cause = "a sack loses yards and can kill a drive";
  return `${favored} gained ${pts} points of win chance because ${cause}${
    late ? ", and with little time left there is less chance to answer" : ""
  }.`;
}

/** Biggest win-chance changes, largest first. A play must move ≥ minSwing to count. */
export function findSwingPlays(
  series: WinProbabilitySeries,
  limit = 3,
  minSwing = 0.08,
): SwingPlay[] {
  const out: SwingPlay[] = [];
  for (let i = 1; i < series.points.length; i++) {
    const prev = series.points[i - 1];
    const cur = series.points[i];
    const delta = cur.home_wp - prev.home_wp;
    if (Math.abs(delta) < minSwing) continue;
    const favored = delta > 0 ? series.home_team_id : series.away_team_id;
    out.push({ point: cur, delta, favored_team_id: favored, why: whyText(delta, cur, favored) });
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}
