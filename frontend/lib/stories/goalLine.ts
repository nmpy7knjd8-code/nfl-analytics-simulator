/** C4 Goal-line stops: plays where the defense stopped a goal-to-go try at the 1 (goalline/v1). Badge on plays only. */
export type GoalLineDoc = { schema: "goalline/v1"; cols: string[]; stops: unknown[][]; rates: { tries: number; rate: number } };

export function isGoalLineDoc(x: unknown): x is GoalLineDoc {
  const d = x as GoalLineDoc;
  return !!d && d.schema === "goalline/v1" && Array.isArray(d.stops) && Array.isArray(d.cols) && !!d.rates && typeof d.rates.rate === "number"
    && ["game_id", "qtr", "clock"].every((c) => d.cols.includes(c));
}

const secOf = (clock: string): number => { const [m, s] = clock.split(":").map(Number); return m * 60 + s; };
export const stopKey = (gameId: string, qtr: number, sec: number | null): string => `${gameId}|${qtr}|${sec == null ? "" : Math.floor(sec)}`;

/** Set of play keys (game, quarter, seconds left in quarter) that were goal-line stops. */
export function stopSet(d: GoalLineDoc): Set<string> {
  const i = (c: string) => d.cols.indexOf(c);
  return new Set(d.stops.map((r) => stopKey(r[i("game_id")] as string, r[i("qtr")] as number, secOf(r[i("clock")] as string))));
}

/** Badge wording: rounded percent, never "0%". */
export function badgeLabel(d: GoalLineDoc): string {
  const n = Math.round(d.rates.rate * 100);
  return `Offenses score on ${n < 1 ? "<1" : n}% of these tries.`;
}
