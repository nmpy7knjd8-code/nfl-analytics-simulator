import raw from "./site/gorates.json";

/** [plays, went for it (run/pass), field goals, punts] for one cell. */
export type GoCell = [plays: number, went: number, fieldGoals: number, punts: number];
export type GoBand = { min: number; max: number };
/** gorates/v1: regulation 4th downs; rows = yards to go (distances), columns = yardline_100 bands. */
export type GoRatesFile = {
  schema: "gorates/v1"; source: string; builtAt: string; dataThrough: string; seasons: number[];
  minPlays: number; maxFgYards: 64; distances: number[]; bands: GoBand[]; cells: GoCell[][];
  /** Engine layer (additive, optional): our 4th-down engine's best call for the same plays as `cells`. */
  engine?: GoEngineMeta; engineCells?: GoEngineCell[][];
};
/** [plays with an engine call, engine says go, kick, punt, close calls (within closeCallPct points of win chance),
 *  coaches went for it when the engine said go]. go + kick + punt = rated. */
export type GoEngineCell = [rated: number, engineGo: number, engineKick: number, enginePunt: number,
  closeCalls: number, wentWhenEngineGo: number];
export type GoEngineMeta = {
  version: string; source: string; dataThrough: string; closeCallPct: number;
  fields: ["rated", "engineGo", "engineKick", "enginePunt", "closeCalls", "wentWhenEngineGo"];
  /** Present only in example stubs; never in the built file. */
  example?: string;
};

export const goRates = raw as unknown as GoRatesFile;
export const FG_SNAP_YARDS = 18;

/** Kick is too far for the whole band when even its closest spot would be past 64 yards. */
export const kickTooFar = (f: GoRatesFile, b: GoBand) => b.min + FG_SNAP_YARDS > f.maxFgYards;
/** Kick is too far for part of the band. */
export const kickPartlyTooFar = (f: GoRatesFile, b: GoBand) => !kickTooFar(f, b) && b.max + FG_SNAP_YARDS > f.maxFgYards;

export function cellAt(f: GoRatesFile, togo: number, yardline100: number): { cell: GoCell; band: GoBand; row: number; col: number } | null {
  const row = f.distances.indexOf(Math.min(Math.max(togo, 1), f.distances[f.distances.length - 1]));
  const col = f.bands.findIndex((b) => yardline100 >= b.min && yardline100 <= b.max);
  if (row < 0 || col < 0) return null;
  return { cell: f.cells[row][col], band: f.bands[col], row, col };
}

/** Engine cell for the same spot as cellAt; null when the file has no engine layer. */
export function engineCellAt(f: GoRatesFile, togo: number, yardline100: number): GoEngineCell | null {
  const at = cellAt(f, togo, yardline100);
  return at && f.engineCells ? f.engineCells[at.row][at.col] : null;
}

export const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

/** "Own 25", "Midfield", "Opp 30" for a yardline_100 value. */
export function spotLabel(y: number): string {
  if (y === 50) return "Midfield";
  return y > 50 ? `Own ${100 - y}` : `Opp ${y}`;
}
