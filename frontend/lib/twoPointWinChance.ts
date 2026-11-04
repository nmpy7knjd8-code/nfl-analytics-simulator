import { CHECKER_ENABLED } from "./features";
import type { Try } from "./twoPoint";

/** Rounded like #269: whole percent of each shown number. */
export const pctShown = (wp: number): number => Math.round(wp * 100);

export type WinChanceRow = { text: string; before: number; after: number };

/**
 * B1: the trying team's real win chance (nflverse vegas_wp) before and after the try.
 * Null when the flag is off, the play is in overtime, or either value is missing.
 */
export function winChanceRow(t: Try, enabled: boolean = CHECKER_ENABLED): WinChanceRow | null {
  if (!enabled || !(t.qtr >= 1 && t.qtr <= 4)) return null;
  if (t.wp_before == null || t.wp_after == null) return null;
  const before = pctShown(t.wp_before), after = pctShown(t.wp_after);
  return { text: `${t.team} win chance: ${before}% \u2192 ${after}% after the try`, before, after };
}
