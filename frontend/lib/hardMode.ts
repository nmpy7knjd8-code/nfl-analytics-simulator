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
