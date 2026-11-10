import raw from "./site/outcomes.json";

export type OutcomeCell = { tries: number; converted: number; penaltyFirstDowns: number; counts: number[] };
export type OutcomeZone = { id: "opp" | "mid" | "own" | "all"; label: string; min: number; max: number };
/** outcomes/v1: yards gained on 4th-down runs and passes, by yards to go (1..10, 10 = 10+) × zone. Key `${togo}-${zone}`. */
export type OutcomesFile = {
  schema: "outcomes/v1"; source: string; builtAt: string; dataThrough: string; seasons: number[];
  minTries: number; bins: number[]; zones: OutcomeZone[]; cells: Record<string, OutcomeCell>;
};

export const outcomes = raw as unknown as OutcomesFile;
export const cellFor = (f: OutcomesFile, togo: number, zone: string): OutcomeCell | null => f.cells[`${togo}-${zone}`] ?? null;
export const binLabel = (f: OutcomesFile, i: number): string => {
  const v = f.bins[i];
  return i === 0 ? `${v} or less` : i === f.bins.length - 1 ? `${v}+` : String(v);
};
