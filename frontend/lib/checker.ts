/**
 * 4th-down checker on the same engine as the Daily.
 *
 * Values come from one of two engine outputs, never from anything else:
 *  1. A real Daily play with exactly this situation: its pack values (FourthDownEngine, #46/#50).
 *  2. Otherwise the engine's checker grid, fourth_down/grid.json (#50), at the nearest grid
 *     clock state and score margin.
 * Either way the values run through lib/daily.ts optionStates / rankedValues / scoreCall,
 * so Kick range, Punt range and Close call are the Daily's rules.
 */
import type { QuizChoice } from "./quiz";
import { CLOSE_CALL_GAP, DAILY_ITEMS, optionStates, rankedValues, scoreCall, type DailyItem, type OptionState } from "./daily";

export type FourthDownGrid = {
  schema_version: string;
  engine_version: string;
  provenance: Record<string, unknown>;
  axes: {
    time: { qtr: number; quarter_seconds_remaining: number }[];
    score_differential: number[];
    distance: number[];
    yardline_100: [number, number];
  };
  fixed: { posteam_timeouts: number; defteam_timeouts: number; is_home_possession: boolean; season: number };
  scale: number;
  close_call_pts: number;
  options: QuizChoice[];
  cells: ([number | null, number | null, number | null] | null)[];
};

export type CheckSituation = {
  distance: number;
  /** Yards from the opponent's end zone (1–99). */
  yardline_100: number;
  posteam_score: number;
  defteam_score: number;
  qtr: number;
  quarter_seconds_remaining: number;
  posteam_timeouts: number;
  defteam_timeouts: number;
};

export type CheckSource =
  | { kind: "play"; item: DailyItem }
  | {
      kind: "grid";
      time: { qtr: number; quarter_seconds_remaining: number };
      score_differential: number;
      distance: number;
      /** What the grid holds fixed that differs from the input (plain words). */
      assumptions: string[];
    };

export type CheckResult = {
  item: DailyItem;
  source: CheckSource;
  options: OptionState[];
  ranked: [QuizChoice, number][];
  best: QuizChoice;
  gap: number;
  closeCall: boolean;
};

export const MIN_DISTANCE = 1;
export const MAX_DISTANCE = 15;

function nearest(values: number[], v: number): number {
  return values.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
}

export function situationFromItem(item: DailyItem): CheckSituation {
  const s = item.situation;
  return {
    distance: s.distance,
    yardline_100: s.yardline_100,
    posteam_score: s.posteam_score,
    defteam_score: s.defteam_score,
    qtr: s.qtr,
    quarter_seconds_remaining: s.quarter_seconds_remaining,
    posteam_timeouts: 3,
    defteam_timeouts: 3,
  };
}

/** A real Daily play with exactly this down, distance, spot, score and clock. */
export function findRealPlay(sit: CheckSituation, items: DailyItem[] = DAILY_ITEMS): DailyItem | null {
  return (
    items.find((it) => {
      const s = it.situation;
      return (
        s.distance === sit.distance &&
        s.yardline_100 === sit.yardline_100 &&
        s.posteam_score - s.defteam_score === sit.posteam_score - sit.defteam_score &&
        s.qtr === sit.qtr &&
        s.quarter_seconds_remaining === sit.quarter_seconds_remaining
      );
    }) ?? null
  );
}

/** Grid lookup: nearest clock state in the same quarter, nearest margin and distance. Null when the grid has no cell (OT, out of range). */
export function gridValues(
  grid: FourthDownGrid,
  sit: CheckSituation,
): { values: Partial<Record<QuizChoice, number>>; time: { qtr: number; quarter_seconds_remaining: number }; score_differential: number; distance: number } | null {
  const sameQ = grid.axes.time.map((t, i) => ({ t, i })).filter(({ t }) => t.qtr === sit.qtr);
  if (!sameQ.length) return null;
  const ti = sameQ.reduce((a, b) =>
    Math.abs(b.t.quarter_seconds_remaining - sit.quarter_seconds_remaining) < Math.abs(a.t.quarter_seconds_remaining - sit.quarter_seconds_remaining) ? b : a,
  ).i;
  const scores = grid.axes.score_differential;
  const diff = nearest(scores, sit.posteam_score - sit.defteam_score);
  const si = scores.indexOf(diff);
  const dist = nearest(grid.axes.distance, sit.distance);
  const di = grid.axes.distance.indexOf(dist);
  const [lo, hi] = grid.axes.yardline_100;
  if (sit.yardline_100 < lo || sit.yardline_100 > hi) return null;
  const cell = grid.cells[((ti * scores.length + si) * grid.axes.distance.length + di) * (hi - lo + 1) + (sit.yardline_100 - lo)];
  if (!cell) return null;
  const values: Partial<Record<QuizChoice, number>> = {};
  grid.options.forEach((opt, k) => {
    const v = cell[k];
    if (v != null) values[opt] = v / grid.scale;
  });
  return { values, time: grid.axes.time[ti], score_differential: diff, distance: dist };
}

function itemFor(sit: CheckSituation, values: Partial<Record<QuizChoice, number>>): DailyItem {
  return {
    id: "checker",
    kind: "checker",
    source: {},
    situation: {
      posteam: "OFF",
      defteam: "DEF",
      home_team: "OFF",
      away_team: "DEF",
      posteam_score: sit.posteam_score,
      defteam_score: sit.defteam_score,
      qtr: sit.qtr,
      quarter_seconds_remaining: sit.quarter_seconds_remaining,
      yardline_100: sit.yardline_100,
      down: 4,
      distance: sit.distance,
    },
    historical_action: null,
    reveal: { recommendation: "", values },
  } as unknown as DailyItem;
}

function finish(item: DailyItem, source: CheckSource): CheckResult | null {
  const ranked = rankedValues(item);
  if (!ranked.length) return null;
  const s = scoreCall(ranked[0][0], item);
  return { item, source, options: optionStates(item), ranked, best: s.best, gap: s.gap, closeCall: s.gap < CLOSE_CALL_GAP };
}

export function checkSituation(sit: CheckSituation, grid: FourthDownGrid | null, items: DailyItem[] = DAILY_ITEMS): CheckResult | null {
  const real = findRealPlay(sit, items);
  if (real) return finish(real, { kind: "play", item: real });
  if (!grid) return null;
  const g = gridValues(grid, sit);
  if (!g) return null;
  const assumptions: string[] = [];
  if (sit.posteam_timeouts !== grid.fixed.posteam_timeouts || sit.defteam_timeouts !== grid.fixed.defteam_timeouts)
    assumptions.push(`timeouts are read as ${grid.fixed.posteam_timeouts}–${grid.fixed.defteam_timeouts}`);
  if (g.time.quarter_seconds_remaining !== sit.quarter_seconds_remaining) assumptions.push(`clock is read as ${clock(g.time.quarter_seconds_remaining)}`);
  if (g.score_differential !== sit.posteam_score - sit.defteam_score) assumptions.push(`score is read as ${marginText(g.score_differential)}`);
  if (g.distance !== sit.distance) assumptions.push(`distance is read as 4th & ${g.distance}`);
  return finish(itemFor(sit, g.values), { kind: "grid", time: g.time, score_differential: g.score_differential, distance: g.distance, assumptions });
}

export function clock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function marginText(d: number): string {
  return d === 0 ? "tied" : d > 0 ? `up ${d}` : `down ${-d}`;
}

/** "own 45" / "midfield" / "opp 38" from the offense's view. */
export function fieldText(yardline100: number): string {
  if (yardline100 === 50) return "midfield";
  return yardline100 > 50 ? `own ${100 - yardline100}` : `opp ${yardline100}`;
}

const NAME: Record<QuizChoice, string> = { go: "Go", fg: "Kick", punt: "Punt" };

/** Nearby situations where the engine's call flips (grid only; real numbers). */
export function whatCouldChange(sit: CheckSituation, grid: FourthDownGrid | null, best: QuizChoice): string[] {
  if (!grid) return [];
  const tries: [string, CheckSituation][] = [];
  const d = sit.posteam_score - sit.defteam_score;
  if (sit.distance > MIN_DISTANCE) tries.push([`4th & ${sit.distance - 1}`, { ...sit, distance: sit.distance - 1 }]);
  if (sit.distance < MAX_DISTANCE) tries.push([`4th & ${sit.distance + 1}`, { ...sit, distance: sit.distance + 1 }]);
  if (sit.yardline_100 > 5) tries.push([`5 yards closer (${fieldText(sit.yardline_100 - 5)})`, { ...sit, yardline_100: sit.yardline_100 - 5 }]);
  if (sit.yardline_100 < 95) tries.push([`5 yards back (${fieldText(sit.yardline_100 + 5)})`, { ...sit, yardline_100: sit.yardline_100 + 5 }]);
  tries.push([`${marginText(d + 3)} instead`, { ...sit, posteam_score: sit.posteam_score + 3 }]);
  tries.push([`${marginText(d - 3)} instead`, { ...sit, defteam_score: sit.defteam_score + 3 }]);
  if (sit.qtr < 4) tries.push(["the same spot late in Q4 (2:00)", { ...sit, qtr: 4, quarter_seconds_remaining: 120 }]);
  const out: string[] = [];
  for (const [label, s] of tries) {
    const g = gridValues(grid, s);
    if (!g) continue;
    const r = finish(itemFor(s, g.values), { kind: "grid", time: g.time, score_differential: g.score_differential, distance: g.distance, assumptions: [] });
    if (r && r.best !== best && !r.closeCall) out.push(`At ${label}, ${NAME[r.best]} becomes the call.`);
    if (out.length >= 3) break;
  }
  return out;
}
