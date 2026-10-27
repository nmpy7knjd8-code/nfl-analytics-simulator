/**
 * One way to say win chance everywhere (UI recheck P1-B): whole numbers, gaps in
 * "points of win chance" (never "%", which reads as a relative change), and the
 * next-best option always named.
 */
import type { QuizChoice } from "./quiz";

export function pct(wp: number): string {
  return `${Math.round(wp * 100)}%`;
}

/** Gap between two win chances: "less than 1 point", "1 point", "12 points". */
export function gapPoints(gap: number): string {
  const n = Math.round(Math.abs(gap) * 100);
  if (n < 1) return "less than 1 point";
  return `${n} ${n === 1 ? "point" : "points"}`;
}

/** Signed badge: "+10 pts" / "-4 pts". */
export function ptsBadge(delta: number): string {
  const n = Math.sign(delta) * Math.round(Math.abs(delta) * 100);
  return `${n > 0 ? "+" : n < 0 ? "-" : ""}${Math.abs(n)} pts`;
}

const DOING: Record<QuizChoice, string> = { go: "going for it", fg: "kicking", punt: "punting" };

/** "Punting gave the Chargers about 2 more points of win chance than going for it (35% vs 32%)." */
export function gapSentence(best: QuizChoice, bestWp: number, next: QuizChoice, nextWp: number, team: string): string {
  const doing = DOING[best][0].toUpperCase() + DOING[best].slice(1);
  const gap = Math.round((bestWp - nextWp) * 100);
  const amount = gap < 1 ? "less than 1 more point" : `about ${gap} more ${gap === 1 ? "point" : "points"}`;
  return `${doing} gave ${team} ${amount} of win chance than ${DOING[next]} (${pct(bestWp)} vs ${pct(nextWp)}).`;
}
