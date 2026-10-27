import fs from "node:fs";
import path from "node:path";
import { storyHref } from "./gameStory";

/** One call in a coach's best / worst list (coaches.v1, #56). */
export type CoachCall = {
  game_id: string;
  play_id: number;
  week: number;
  opponent: string;
  qtr: number;
  ydstogo: number;
  yardline_100: number;
  score_differential: number;
  actual: "go" | "punt" | "fg";
  recommendation: "go" | "punt" | "fg";
  wp_cost_pts: number;
  result: string;
  desc: string;
  /** coaches.v1.1 (#56): nflverse win chance before the snap (offense, 0-1). */
  wp_before: number | null;
  /** Engine's expected win chance after the option the coach chose. */
  wp_after_chosen: number;
  /** Engine's expected win chance after its best option. */
  wp_after_best: number;
  /** nflverse win chance after the real play. */
  wp_after_actual: number | null;
  /** Signed: +gap if he made the best call, else minus the cost. */
  decision_value_pts: number;
  /** Rough: mixes nflverse and our engine. + means the play beat the plan. */
  outcome_vs_expected_pts: number | null;
  net_value_pts: number;
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
  /** Always null until the calibrated model (#37) lands. */
  grade: string | null;
  best: CoachCall[];
  worst: CoachCall[];
  /** coaches.v1.1: games with at least one 4th-down call. */
  games: number;
  /** Sum of win-chance points given up (= -net_wp_pts). */
  wp_cost_pts_total: number;
  /** Signed sum of call values over clear calls. */
  decision_value_pts: number;
  /** Rough (two models). */
  outcome_vs_expected_pts: number;
  net_value_pts: number;
};

export type CoachSeason = {
  schema_version: "coaches.v1.1";
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
  | { kind: "pending"; text: "Grade coming once the model is calibrated" }
  | { kind: "grade"; text: string };

/**
 * Grade column. Under 20 qualifying calls never gets a grade. Everyone else waits
 * for the calibrated model (#37): a letter only shows if the data file carries one.
 */
export function gradeCell(c: Coach, min = MIN_CALLS): GradeCell {
  if (c.qualifying_calls < min || !c.gradeable) return { kind: "not-enough", text: "Not enough calls" };
  if (c.grade == null) return { kind: "pending", text: "Grade coming once the model is calibrated" };
  return { kind: "grade", text: c.grade };
}

/** "Went when he should": share of should-go calls where he went. Null if none. */
export function wentWhenShould(c: Coach): number | null {
  return c.should_go > 0 ? c.went_when_should_go / c.should_go : null;
}

export function pctText(x: number | null): string {
  return x == null ? "—" : `${Math.round(x * 100)}%`;
}

/** "Win chance 48% before · 52% after his call · 55% after the best call · 61% after the real play" */
export function callWinChances(c: CoachCall): string {
  const parts = [
    c.wp_before != null ? `${pctText(c.wp_before)} before` : null,
    `${pctText(c.wp_after_chosen)} after his call`,
    c.actual === c.recommendation ? null : `${pctText(c.wp_after_best)} after the best call`,
    c.wp_after_actual != null ? `${pctText(c.wp_after_actual)} after the real play` : null,
  ].filter(Boolean);
  return `Win chance ${parts.join(" · ")}`;
}

export const ROUGH_NOTE =
  "“Beat expectation” is rough: it compares nflverse's win chance after the real play with our 4th-down model's estimate, two different models.";

export function signedPts(x: number): string {
  const r = Math.round(x * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "-" : ""}${Math.abs(r).toFixed(1)}`;
}

export function coachHref(team: string, season: number): string {
  return `/coaches/${team}/${season}/`;
}

export function seasonHref(season: number): string {
  return season === LATEST_SEASON ? "/coaches/" : `/coaches/${season}/`;
}

/** Sorted by net win chance, best first. */
export function rankCoaches(cs: Coach[]): Coach[] {
  return [...cs].sort((a, b) => b.decision_value_pts - a.decision_value_pts || a.coach.localeCompare(b.coach));
}

const CALL: Record<CoachCall["actual"], string> = { go: "went for it", punt: "punted", fg: "kicked the field goal" };
const REC: Record<CoachCall["recommendation"], string> = { go: "go for it", punt: "punt", fg: "kick the field goal" };

export function callLine(c: CoachCall, team: string): string {
  const side = c.yardline_100 > 50 ? `own ${100 - c.yardline_100}` : c.yardline_100 === 50 ? "midfield" : `${c.opponent} ${c.yardline_100}`;
  const m = c.score_differential;
  const score = m === 0 ? "tied" : m > 0 ? `up ${m}` : `down ${-m}`;
  return `Week ${c.week} vs ${c.opponent} · Q${c.qtr} · 4th & ${c.ydstogo} at ${side} · ${team} ${score}`;
}

export function callVerdict(c: CoachCall, team: string): string {
  return c.actual === c.recommendation
    ? `${team} ${CALL[c.actual]}, the model's call.`
    : `${team} ${CALL[c.actual]}. Model said ${REC[c.recommendation]}.`;
}

export function callStoryHref(c: CoachCall): string | null {
  return storyHref(c.game_id, c.play_id);
}
