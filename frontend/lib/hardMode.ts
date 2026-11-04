import { dailySet, practiceSet, type DailyItem } from "./daily";
/**
 * E6 Hard mode (spec: #85 #9). Before each reveal you say how sure you are (50–100%).
 * The end screen gives a calibration score out of 100 = 100 × (1 − Brier), where the
 * "outcome" is the credit you got (right 1, close call ½, wrong 0). UI only: the daily
 * set itself never changes.
 */
export const CONFIDENCE_STEPS = [50, 60, 70, 80, 90, 100] as const;
export type Confidence = (typeof CONFIDENCE_STEPS)[number];
export const HARD_MODE_KEY = "fourth-and-daily.hard.v1";

export function calibrationScore(rows: { confidence: number; credit: number }[]): number | null {
  if (!rows.length) return null;
  const brier = rows.reduce((a, r) => a + (r.confidence / 100 - r.credit) ** 2, 0) / rows.length;
  return Math.round(100 * (1 - brier));
}

export function readHard(st: Pick<Storage, "getItem"> | null | undefined): boolean {
  try { return st?.getItem(HARD_MODE_KEY) === "1"; } catch { return false; }
}

export function writeHard(st: Pick<Storage, "setItem"> | null | undefined, on: boolean): void {
  try { st?.setItem(HARD_MODE_KEY, on ? "1" : "0"); } catch { /* private mode */ }
}

export function calibrationLine(score: number): string {
  return `Hard mode calibration: ${score}/100. 100 means your confidence matched your results exactly.`;
}

/** The set the game renders. Deliberately takes no Hard-mode input: Hard mode can never change which plays you get. */
export function gameItems(mode: "daily" | "practice", key: string | null, seed: string): DailyItem[] {
  return key == null ? [] : mode === "daily" ? dailySet(key) : practiceSet(seed);
}

/** Confidence answers saved per ET day, so a reload mid-game keeps them. */
export const HARD_CONFS_KEY = "fourth-and-daily.hard-confs.v1";
type Store = Pick<Storage, "getItem" | "setItem">;

export function readConfs(st: Pick<Storage, "getItem"> | null | undefined, day: string): (number | null)[] {
  try {
    const v = JSON.parse(st?.getItem(HARD_CONFS_KEY) ?? "null") as { day?: unknown; confs?: unknown } | null;
    if (!v || v.day !== day || !Array.isArray(v.confs)) return [];
    return v.confs.map((c) => ((CONFIDENCE_STEPS as readonly number[]).includes(c as number) ? (c as number) : null));
  } catch { return []; }
}

export function writeConfs(st: Store | null | undefined, day: string, confs: (number | null)[]): void {
  try { st?.setItem(HARD_CONFS_KEY, JSON.stringify({ day, confs })); } catch { /* private mode */ }
}

/** End-screen line: the score, or a plain note when an answer is missing (e.g. Hard mode switched on late). */
export function calibrationText(confs: (number | null | undefined)[], credits: number[]): string | null {
  if (!credits.length) return null;
  if (credits.some((_, i) => confs[i] == null)) return `Calibration needs all ${credits.length} answers.`;
  return calibrationLine(calibrationScore(credits.map((credit, i) => ({ confidence: confs[i] as number, credit })))!);
}

/** End-of-day toggle. The setting applies from the next daily, so today's flow never changes mid-game. */
export const HARD_NEXT_LABEL = "Hard mode from the next daily: rate how sure you are";
