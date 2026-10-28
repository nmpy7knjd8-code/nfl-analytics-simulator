/**
 * A2 Coach vs. You: a local record of your daily picks next to the real coach's call.
 * Stored only in this browser. The swing uses the same shown values that graded the pick
 * (frozen per day), so the verdict always matches the answer card.
 */
import type { QuizChoice } from "./quiz";
import { formatPercents, type DailyItem } from "./daily";

export const COACH_STORAGE_KEY = "fourth-and-daily.coach.v1";

export type CoachEntry = {
  date: string;
  id: string;
  pick: QuizChoice;
  coach: QuizChoice;
  /** Win-chance points your pick gained over the coach's call at the shown %, e.g. +4 or -2. */
  swing: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function coachCall(item: DailyItem): QuizChoice | null {
  const a = item.historical_action;
  return a === "go" || a === "fg" || a === "punt" ? a : null;
}

/** Whole points between two shown values; 0 when they show the same %. */
export function swingPoints(item: DailyItem, pick: QuizChoice, coach: QuizChoice): number {
  const v = item.reveal.values;
  const a = v[pick], b = v[coach];
  if (typeof a !== "number" || typeof b !== "number") return 0;
  const [fa, fb] = formatPercents([a, b]);
  if (fa === fb) return 0;
  return Math.round((a - b) * 100);
}

export function entryFor(date: string, item: DailyItem, pick: QuizChoice): CoachEntry | null {
  const coach = coachCall(item);
  if (!coach) return null;
  return { date, id: item.id, pick, coach, swing: pick === coach ? 0 : swingPoints(item, pick, coach) };
}

/** Add one day's entries. Replaying a day replaces its entries instead of double-counting. */
export function addCoachDay(prev: CoachEntry[], date: string, rows: CoachEntry[]): CoachEntry[] {
  return [...prev.filter((e) => e.date !== date), ...rows].slice(-5 * 400);
}

export function coachTally(es: CoachEntry[]): { agreed: number; differed: number } {
  const agreed = es.filter((e) => e.pick === e.coach).length;
  return { agreed, differed: es.length - agreed };
}

/** Plain verdict for a disagreement, honest both ways. */
export function verdictText(e: CoachEntry): string {
  if (e.pick === e.coach) return "You made the same call as the coach.";
  if (e.swing === 0) return "The numbers called it about even.";
  return e.swing > 0
    ? `The numbers liked your call: about +${e.swing} in chance to win.`
    : `The numbers liked the coach's call: about +${-e.swing} in chance to win.`;
}

function valid(e: unknown): e is CoachEntry {
  const x = e as CoachEntry;
  const c = ["go", "fg", "punt"];
  return !!x && typeof x.date === "string" && typeof x.id === "string" && c.includes(x.pick) && c.includes(x.coach) && Number.isFinite(x.swing);
}

export function loadCoach(st: StorageLike | undefined): CoachEntry[] {
  try {
    const v = JSON.parse(st?.getItem(COACH_STORAGE_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter(valid) : [];
  } catch {
    return [];
  }
}

export function saveCoach(st: StorageLike | undefined, es: CoachEntry[]): void {
  try { st?.setItem(COACH_STORAGE_KEY, JSON.stringify(es)); } catch { /* private mode */ }
}
