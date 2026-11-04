import { CHECKER_ENABLED } from "./features";
import { outcomes, type OutcomesFile } from "./outcomes";

/**
 * A1 Break-even bar. Phase 1 = the real half only: how often teams actually convert this
 * 4th down (nflverse runs + passes, outcomes/v1). The "needed" marker is engine-derived
 * and only renders when CHECKER_ENABLED is true and the pack carries a breakeven value.
 */
export type RealRate = { pct: number; converted: number; tries: number; togo: number; zone: string; place: string };

const PLACE: Record<string, string> = { opp: "inside the 40", mid: "near midfield", own: "on own side", all: "anywhere" };

export function zoneFor(f: OutcomesFile, yardline100: number): string | null {
  return f.zones.find((z) => z.id !== "all" && yardline100 >= z.min && yardline100 <= z.max)?.id ?? null;
}

/** Real conversion rate for 4th-and-`distance` at `yardline100`; falls back to all zones when a cell is thin. */
export function realRate(distance: number, yardline100: number, f: OutcomesFile = outcomes): RealRate | null {
  if (!Number.isFinite(distance) || distance < 1 || !Number.isFinite(yardline100)) return null;
  const togo = Math.min(Math.round(distance), 10);
  const zone = zoneFor(f, yardline100);
  for (const z of zone ? [zone, "all"] : ["all"]) {
    const c = f.cells[`${togo}-${z}`];
    if (c && c.tries >= f.minTries) {
      return { pct: Math.round((100 * c.converted) / c.tries), converted: c.converted, tries: c.tries, togo, zone: z, place: PLACE[z] };
    }
  }
  return null;
}

/** Engine break-even rate (0..1) from the pack, flag-gated. Not in any pack yet, so null today. */
export function neededRate(reveal: unknown, enabled: boolean = CHECKER_ENABLED): number | null {
  if (!enabled) return null;
  const v = (reveal as { breakeven?: unknown } | null)?.breakeven;
  return typeof v === "number" && v >= 0 && v <= 1 ? v : null;
}

export const realRateLabel = (r: RealRate) => `Real 4th-and-${r.togo === 10 ? "10+" : r.togo} tries ${r.place}`;
export const realRateText = (r: RealRate) => `${r.pct}% converted`;
export const realRateSource = (r: RealRate, f: OutcomesFile = outcomes) =>
  `${r.converted.toLocaleString("en-US")} of ${r.tries.toLocaleString("en-US")} since ${f.seasons[0]}`;
