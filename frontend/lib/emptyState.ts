/**
 * A6 empty states: every dead end on the Daily screens has one next step.
 * Pure helpers; the screens live in components/EmptyState.tsx.
 */
import { formatScore, type StreakState } from "./daily";

/** Today's finished result, or null when today's five haven't been played on this device. */
export function playedToday(s: StreakState, today: string): { score: string; answered: number } | null {
  if (s.last_completed !== today) return null;
  const h = [...s.history].reverse().find((x) => x.date === today);
  return h ? { score: formatScore(h.credit), answered: h.answered } : { score: "–", answered: 5 };
}

/** "07:42:05" (tabular hh:mm:ss) until the next set. */
export function clockCountdown(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(t / 3600))}:${p(Math.floor((t % 3600) / 60))}:${p(t % 60)}`;
}

/** Streak line that never reads as a dead end. */
export function streakLine(n: number): string {
  return n > 0 ? `${n}-day streak` : "New streak starts today.";
}
