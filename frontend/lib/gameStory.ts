/**
 * Game Story helpers for C6 games/{id}.json (game.v1, PR #52). Pure and tested.
 * Every sentence is built from the file's own numbers; nothing is invented.
 */
import type { QuizChoice } from "./quiz";
import { CLOSE_LABEL } from "./daily";

export type FourthDownCheck = {
  close_call: boolean;
  engine_version: string;
  gap_pts: number;
  home_wp: Partial<Record<QuizChoice, number>>;
  kick_distance: number;
  options: QuizChoice[];
  recommendation: QuizChoice;
  /** Possession team's win chance by option. */
  wp: Partial<Record<QuizChoice, number>>;
  actual: QuizChoice | null;
};

export type GamePlay = {
  play_id: number;
  qtr: number;
  clock: string;
  posteam: string | null;
  down: number | null;
  ydstogo: number;
  yardline_100: number | null;
  text: string;
  play_type: string | null;
  home_wp: number;
  home_wp_after: number;
  swing: boolean;
  home_score: number;
  away_score: number;
  fourth_down: FourthDownCheck | null;
};

export type GameFile = {
  schema_version: string;
  provenance: { source: string; nflreadpy_version: string; data_sha256: string; build_date: string; license?: string; [k: string]: unknown };
  game: {
    id: string;
    season: number;
    week: number;
    season_type: string;
    date: string;
    home: string;
    away: string;
    home_score: number;
    away_score: number;
    overtime: boolean;
    stadium: string;
    home_coach?: string;
    away_coach?: string;
  };
  wp_perspective: "home";
  swing_threshold: number;
  final_home_wp: number;
  swing_play_ids: number[];
  plays: GamePlay[];
};

/** The 3 fixture games with committed files (public/data/games). */
export const STORY_GAME_IDS = ["2023_01_DET_KC", "2023_01_BUF_NYJ", "2023_03_PHI_TB"] as const;

export function hasStory(gameId: string | undefined | null): boolean {
  return !!gameId && (STORY_GAME_IDS as readonly string[]).includes(gameId);
}

/** Link from a Daily play to its spot in the game story, or null when there is no story page. */
export function storyHref(gameId: string | undefined | null, playId: number | null): string | null {
  if (!hasStory(gameId) || playId == null) return null;
  return `/games/${gameId}/#play-${playId}`;
}

/** Daily item ids are "{game_id}-{play_id}". */
export function playIdFromItemId(id: string): number | null {
  const m = /-(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

export function clockSeconds(clock: string): number {
  const [m, s] = clock.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

/** Seconds since kickoff (regular-season OT is 10:00). */
export function elapsed(p: Pick<GamePlay, "qtr" | "clock">): number {
  const len = p.qtr > 4 ? 600 : 900;
  return Math.min(4, p.qtr - 1) * 900 + Math.max(0, p.qtr - 5) * 600 + (len - clockSeconds(p.clock));
}

export function periodName(q: number): string {
  return q > 4 ? (q === 5 ? "OT" : `OT${q - 4}`) : `Q${q}`;
}

/** "DET 58%": the team the number belongs to, always the side that's ahead (or home at 50). */
export function wpLabel(homeWp: number, home: string, away: string): string {
  const h = Math.round(homeWp * 100);
  return h >= 50 ? `${home} ${h}%` : `${away} ${100 - h}%`;
}

export function winner(g: GameFile["game"]): string | null {
  return g.home_score === g.away_score ? null : g.home_score > g.away_score ? g.home : g.away;
}

export type NumberedSwing = { n: number; play: GamePlay; delta: number };

/** The 5 biggest flagged swings, numbered 1–5 in game order. */
export function numberedSwings(file: GameFile, max = Infinity): NumberedSwing[] {
  const swings = file.plays
    .filter((p) => p.swing)
    .map((p) => ({ play: p, delta: p.home_wp_after - p.home_wp }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, max);
  const order = new Map(file.plays.map((p, i) => [p, i]));
  return swings.sort((a, b) => order.get(a.play)! - order.get(b.play)!).map((s, i) => ({ n: i + 1, ...s }));
}

export function leadChanges(file: GameFile): number {
  let leader = 0;
  let changes = 0;
  for (const p of file.plays) {
    const now = Math.sign(p.home_score - p.away_score);
    if (now !== 0 && leader !== 0 && now !== leader) changes++;
    if (now !== 0) leader = now;
  }
  return changes;
}

export type FourthDownGrade = { label: string; tone: "match" | "close" | "miss" };

const NAME: Record<QuizChoice, string> = { go: "Go", fg: "Kick", punt: "Punt" };

/** Mini grade: did the coach's call match the engine's? */
export function grade(fd: FourthDownCheck): FourthDownGrade | null {
  if (!fd.actual) return null;
  if (fd.actual === fd.recommendation) return { label: `Matched: ${NAME[fd.recommendation]}`, tone: "match" };
  if (fd.close_call) return { label: `${CLOSE_LABEL}: ${NAME[fd.actual]} or ${NAME[fd.recommendation]}`, tone: "close" };
  const mine = fd.wp[fd.actual];
  const best = fd.wp[fd.recommendation];
  const cost = mine != null && best != null ? ` (−${((best - mine) * 100).toFixed(1)} pts)` : "";
  return { label: `Model: ${NAME[fd.recommendation]}${cost}`, tone: "miss" };
}

function shortText(text: string): string {
  const t = text.replace(/^(\([^)]*\)\s*)+/, "").replace(/\s*\([^)]*\)\.?$/, "").trim();
  let first = t.split(/\.\s+(?=[A-Z0-9(])/)[0].replace(/\.$/, "");
  if (/TOUCHDOWN/.test(t) && !/TOUCHDOWN/.test(first)) first += ", touchdown on the return";
  return first.length > 90 ? `${first.slice(0, 87).trimEnd()}…` : first;
}

/** 3–5 templated sentences from the game's own numbers. */
export function narrator(file: GameFile): string[] {
  const g = file.game;
  const w = winner(g);
  const out: string[] = [];
  const hi = Math.max(g.home_score, g.away_score);
  const lo = Math.min(g.home_score, g.away_score);
  out.push(
    w
      ? `${w} beat ${w === g.home ? g.away : g.home} ${hi}–${lo}${g.overtime ? " in overtime" : ""} at ${g.stadium}.`
      : `${g.away} and ${g.home} tied ${hi}–${lo} at ${g.stadium}.`,
  );
  const swings = numberedSwings(file, 50);
  if (swings.length) {
    const big = swings.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
    out.push(
      `Biggest swing: ${periodName(big.play.qtr)} ${big.play.clock}, ${shortText(big.play.text)} — ${wpLabel(big.play.home_wp, g.home, g.away)} to ${wpLabel(big.play.home_wp_after, g.home, g.away)}.`,
    );
  }
  if (w) {
    const wWp = (p: GamePlay) => (w === g.home ? p.home_wp : 1 - p.home_wp);
    const low = file.plays.reduce((a, b) => (wWp(b) < wWp(a) ? b : a));
    const pct = Math.round(wWp(low) * 100);
    if (pct < 35) out.push(`${w} won after falling to ${w} ${pct}% at ${periodName(low.qtr)} ${low.clock}.`);
  }
  const lc = leadChanges(file);
  out.push(lc === 0 ? "The lead never changed hands." : `The lead changed hands ${lc} time${lc === 1 ? "" : "s"}.`);
  const fds = file.plays.filter((p) => p.fourth_down?.actual);
  if (fds.length) {
    const matched = fds.filter((p) => p.fourth_down!.actual === p.fourth_down!.recommendation).length;
    const close = fds.filter((p) => p.fourth_down!.actual !== p.fourth_down!.recommendation && p.fourth_down!.close_call).length;
    out.push(
      `On ${fds.length} fourth downs, the coaches matched the model ${matched} time${matched === 1 ? "" : "s"}${close ? `, and ${close} more were close calls` : ""}.`,
    );
  }
  return out.slice(0, 5);
}

export function quarters(file: GameFile): { qtr: number; plays: GamePlay[] }[] {
  const out: { qtr: number; plays: GamePlay[] }[] = [];
  for (const p of file.plays) {
    const last = out[out.length - 1];
    if (last && last.qtr === p.qtr) last.plays.push(p);
    else out.push({ qtr: p.qtr, plays: [p] });
  }
  return out;
}

export function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** House rule (#73): no win chance in overtime. The chart, swings and story use regulation plays only. */
export function regulationOnly(file: GameFile): GameFile {
  return { ...file, plays: file.plays.filter((p) => p.qtr <= 4) };
}
