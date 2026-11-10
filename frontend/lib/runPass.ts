/**
 * A3 bonus: run or pass on 4th-and-1 (not goal to go).
 * Source: nflverse play-by-play 2019–2025, 4th-and-1 go-for-it plays, first-down rate.
 * Checked by mining/verify_all.py → verify_out.txt ("4th&1 run %" / "4th&1 pass %").
 * Real numbers only. Change them only after re-running that check.
 */
export const RUN_PASS_4TH_1 = {
  run: { pct: 71.4, tries: 1629 },
  pass: { pct: 54.3, tries: 549 },
  seasons: "2019–2025",
} as const;

export type Guess = "run" | "pass";

/** The bonus shows only after a Go pick on 4th-and-1 that isn't goal to go. */
export function showsRunPassBonus(pick: string, distance: number, goalToGo: boolean): boolean {
  return pick === "go" && distance === 1 && !goalToGo;
}

/** Real data says runs convert more often, so "run" is the better bet. No effect on the score. */
export function runPassVerdict(g: Guess): string {
  const { run, pass } = RUN_PASS_4TH_1;
  return g === "run"
    ? `Good call. Runs got the first down ${run.pct}% of the time, passes ${pass.pct}%.`
    : `Runs did better: ${run.pct}% got the first down, passes ${pass.pct}%.`;
}
