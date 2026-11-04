import fs from "node:fs";
import path from "node:path";

/** Ported from closed PR #59. Engine-derived: pages render only when CHECKER_ENABLED is true. */

/** One call in a coach's best / worst list (coaches.v1.2). Keyed by game_id + qtr + clock; no play_id. */
export type CoachCall = {
  game_id: string;
  qtr: number;
  /** Game clock at the snap, "M:SS" left in the quarter. */
  clock: string;
  week: number;
  opponent: string;
  ydstogo: number;
  yardline_100: number;
  score_differential: number;
  actual: "go" | "punt" | "fg";
  recommendation: "go" | "punt" | "fg";
  wp_cost_pts: number;
  result: string;
  desc: string;
  wp_before: number | null;
  wp_after_chosen: number | null;
  wp_after_best: number | null;
  wp_after_actual: number | null;
  decision_value_pts: number;
  outcome_vs_expected_pts: number | null;
  net_value_pts: number;
  /** Win-chance points the call beat (+) or trailed (−) the best other option by. */
  alt_cost_pts: number;
};

export type Coach = {
  coach: string;
  team: string;
  calls: number;
  qualifying_calls: number;
  agreed: number;
  should_go: number;
  went_when_should_go: number;
  kicked_when_should_go: number;
  went_when_should_kick: number;
  go_rate: number;
  net_wp_pts: number;
  min_calls_for_grade: number;
  gradeable: boolean;
  /** Letter grade when the data file carries one; null otherwise. */
  grade: string | null;
  games: number;
  wp_cost_pts_total: number;
  decision_value_pts: number;
  outcome_vs_expected_pts: number;
  net_value_pts: number;
  /** Ranked by alt_cost_pts; shown as "Best calls". */
  best: CoachCall[];
  worst: CoachCall[];
};

export type CoachSeason = {
  schema_version: "coaches.v1.2";
  engine_version: string;
  provenance: { source: string; build_date: string; license: string; nflreadpy_version: string };
  season: number;
  qualifying_rule: string;
  min_calls_for_grade: number;
  grade_status: string;
  coaches: Coach[];
};

export const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;
export const LATEST_SEASON = SEASONS[SEASONS.length - 1];
export const MIN_CALLS = 20;

const DIR = path.join(process.cwd(), "public", "data", "coaches");

export function readSeason(season: number): CoachSeason {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${season}.json`), "utf8")) as CoachSeason;
}

export function isSeason(s: string): boolean {
  return (SEASONS as readonly number[]).includes(Number(s));
}

export type GradeCell =
  | { kind: "not-enough"; text: "Not enough calls" }
  | { kind: "pending"; text: "No grade" }
  | { kind: "grade"; text: string };

/**
 * Grade column. Under 20 qualifying calls never gets a grade. Everyone else waits
 * for a letter: one only shows if the data file carries one.
 */
export function gradeCell(c: Coach, min = MIN_CALLS): GradeCell {
  if (c.qualifying_calls < min || !c.gradeable) return { kind: "not-enough", text: "Not enough calls" };
  if (c.grade == null) return { kind: "pending", text: "No grade" };
  return { kind: "grade", text: c.grade };
}

/** "Went when he should": share of should-go calls where he went. Null if none. */
export function wentWhenShould(c: Coach): number | null {
  return c.should_go > 0 ? c.went_when_should_go / c.should_go : null;
}

export function pctText(x: number | null): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}

export function signedPts(x: number): string {
  const r = Math.round(x * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`;
}

export function coachHref(team: string, season: number): string {
  return `/coaches/${team}/${season}/`;
}

export function seasonHref(season: number): string {
  return season === LATEST_SEASON ? "/coaches/" : `/coaches/${season}/`;
}

/** Average win-chance points per 4th-down call vs the model's pick (net_wp_pts is the season sum over every call). */
export function avgPerCall(c: Coach): number {
  return c.calls ? c.net_wp_pts / c.calls : 0;
}

/** Shared % wording for every win-chance number on coach screens (no "pts"/"points"). */
export function wcPct(v: number): string {
  return `${Math.abs(v).toFixed(1)}%`;
}
/** Average per call: "0.4% less chance to win per call"; positive reads "more"; zero reads "Same chance to win as the model". */
export function avgAmount(v: number): string {
  if (wcPct(v) === "0.0%") return "Same chance to win as the model";
  return `${wcPct(v)} ${v < 0 ? "less" : "more"} chance to win per call`;
}
/** Data-file copy (e.g. qualifying_rule) put into the same % wording: "2 win-chance points" -> "2% chance to win". */
export function pctWording(t: string): string {
  return t.replace(/(\d+(?:\.\d+)?)\s*win-chance (?:points|pts)\b/gi, "$1% chance to win");
}
export const avgText = (c: Coach) => avgAmount(avgPerCall(c));
/** Costliest-calls row. */
export function costNote(cost: number): string {
  return wcPct(cost) === "0.0%" ? "No cost." : `${wcPct(cost)} less chance to win than the model's pick.`;
}

/** One plain line under the number. */
export const AVG_LINE = "Average per call: how much chance to win he gave up (or gained) on each 4th down compared with the model's pick. Same chance means he always matched it.";

/** Sorted by average per call, best first. */
export function rankCoaches(cs: Coach[]): Coach[] {
  return [...cs].sort((a, b) => avgPerCall(b) - avgPerCall(a) || a.coach.localeCompare(b.coach));
}

const CALL: Record<CoachCall["actual"], string> = { go: "went for it", punt: "punted", fg: "kicked the field goal" };
const REC: Record<CoachCall["recommendation"], string> = { go: "go for it", punt: "punt", fg: "kick the field goal" };

const PLAYOFF_ROUNDS = ["Wild Card", "Divisional", "Conference Championship", "Super Bowl"];

/** "Week 7" in the regular season; playoff weeks by round name (Week 19 in 2021+ / Week 18 in 2019–20 is the Wild Card). */
export function weekLabel(season: number, week: number): string {
  const first = season >= 2021 ? 19 : 18;
  return week >= first ? PLAYOFF_ROUNDS[week - first] ?? `Week ${week}` : `Week ${week}`;
}

export function callLine(c: CoachCall, team: string): string {
  const side = c.yardline_100 > 50 ? `own ${100 - c.yardline_100}` : c.yardline_100 === 50 ? "midfield" : `${c.opponent} ${c.yardline_100}`;
  const m = c.score_differential;
  const score = m === 0 ? "tied" : m > 0 ? `up ${m}` : `down ${-m}`;
  return `${weekLabel(Number(c.game_id.slice(0, 4)), c.week)} vs ${c.opponent} · Q${c.qtr} · 4th & ${c.ydstogo} at ${side} · ${team} ${score}`;
}

export function callVerdict(c: CoachCall, team: string): string {
  return c.actual === c.recommendation
    ? `${team} ${CALL[c.actual]}, the model's call.`
    : `${team} ${CALL[c.actual]}. Model said ${REC[c.recommendation]}.`;
}

/** Best-calls note: how far the call beat the next-best choice (alt_cost_pts, win-chance points). */
export function bestNote(c: CoachCall): string {
  return `${wcPct(c.alt_cost_pts)} more chance to win than the next-best choice.`;
}

/** Best calls worth showing: regulation, and the call actually beat the other choices. */
export function bestCalls(calls: CoachCall[]): CoachCall[] {
  return regulationOnly(calls).filter((c) => c.alt_cost_pts > 0).sort((a, b) => b.alt_cost_pts - a.alt_cost_pts);
}

/** Overtime calls never show win chance (house rule); the coaches.v1 files carry none, this keeps it true. */
export function regulationOnly(calls: CoachCall[]): CoachCall[] {
  return calls.filter((c) => c.qtr <= 4);
}
