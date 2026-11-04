/**
 * B4 friend challenge: your five picks ride in the URL hash (#c=<day>.<picks>), never sent to a
 * server. One letter per pick: g = go, k = field goal, p = punt.
 */
import type { QuizChoice } from "./quiz";

const TO: Record<QuizChoice, string> = { go: "g", fg: "k", punt: "p" };
const FROM: Record<string, QuizChoice> = { g: "go", k: "fg", p: "punt" };

export type Challenge = { day: number; picks: QuizChoice[] };

export function encodeChallenge(day: number, picks: QuizChoice[]): string {
  return `c=${day}.${picks.map((p) => TO[p]).join("")}`;
}

/** Parses "#c=300.gkpgg". Anything malformed → null (never throws). */
export function decodeChallenge(hash: string): Challenge | null {
  const m = /^#?c=(\d{1,5})\.([gkp]{1,10})$/.exec(hash.trim());
  if (!m) return null;
  return { day: Number(m[1]), picks: [...m[2]].map((c) => FROM[c]) };
}

export type ChallengeStatus = { kind: "none" } | { kind: "bad" } | { kind: "ok"; picks: QuizChoice[] };

/** A challenge only works for today's set and must have one pick per play. */
export function challengeFor(hash: string, today: number, size: number): ChallengeStatus {
  if (!hash || hash === "#") return { kind: "none" };
  const c = decodeChallenge(hash);
  if (!c || c.day !== today || c.picks.length !== size) return { kind: "bad" };
  return { kind: "ok", picks: c.picks };
}

export function agreedCount(mine: QuizChoice[], theirs: QuizChoice[]): number {
  return mine.filter((p, i) => theirs[i] === p).length;
}

export const SHORT: Record<QuizChoice, string> = { go: "Go", fg: "Kick", punt: "Punt" };
