import raw from "./site/calib.json";

/** One bucket of game moments (every nflverse row: snaps plus timeouts, quarter ends) by the home team's predicted chance to win, [lo, hi) in percent. */
export type CalibBucket = { lo: number; hi: number; moments: number; predicted: number; actual: number };
/** model: whose win chance is checked. "nflverse" now; "ours" may be added after H6. */
export type CalibFile = { schema: "calib/v1"; model: "nflverse" | "ours"; source: string; builtAt?: unknown; buckets: CalibBucket[] };

export const calib = raw as unknown as CalibFile;
