import raw from "./site/era.json";

/** [fourth downs, went for it] — go = run or pass; denominator = run + pass + punt + field goal. */
export type EraCount = [plays: number, went: number];
export type EraZoneId = "opp" | "mid" | "own";
/** Zone by yardline_100 (distance to the opponent's goal line), inclusive. */
export type EraZone = { id: EraZoneId; label: string; short: string; min: number; max: number };
export type EraSeason = { season: number } & Record<EraZoneId | "all", EraCount>;
export type EraFile = { schema: "era/v1"; source: string; builtAt?: unknown; zones: EraZone[]; seasons: EraSeason[] };

export const era = raw as unknown as EraFile;
export const goRate = ([n, g]: EraCount): number | null => (n ? (100 * g) / n : null);
