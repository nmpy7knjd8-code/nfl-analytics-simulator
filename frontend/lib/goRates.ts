import raw from "./site/gorates.json";
import { CHECKER_ENABLED } from "./features";

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

const ENGINE_FIELDS: GoEngineMeta["fields"] = ["rated", "engineGo", "engineKick", "enginePunt", "closeCalls", "wentWhenEngineGo"];

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;

function parseBand(v: unknown): GoBand | null {
  if (!isRecord(v) || !isInt(v.min) || !isInt(v.max)) return null;
  return { min: v.min, max: v.max };
}

function parseCell(v: unknown): GoCell | null {
  if (!Array.isArray(v) || v.length !== 4 || !v.every(isInt)) return null;
  return [v[0], v[1], v[2], v[3]];
}

function parseEngineCell(v: unknown): GoEngineCell | null {
  if (!Array.isArray(v) || v.length !== 6 || !v.every(isInt)) return null;
  return [v[0], v[1], v[2], v[3], v[4], v[5]];
}

function parseEngineMeta(v: unknown): GoEngineMeta | null {
  if (!isRecord(v)) return null;
  if (typeof v.version !== "string" || typeof v.source !== "string" || typeof v.dataThrough !== "string") return null;
  if (!isInt(v.closeCallPct)) return null;
  const fields = v.fields;
  if (!Array.isArray(fields) || fields.length !== ENGINE_FIELDS.length) return null;
  if (!ENGINE_FIELDS.every((name, i) => fields[i] === name)) return null;
  const meta: GoEngineMeta = {
    version: v.version,
    source: v.source,
    dataThrough: v.dataThrough,
    closeCallPct: v.closeCallPct,
    fields: ENGINE_FIELDS,
  };
  if (typeof v.example === "string") meta.example = v.example;
  return meta;
}

function parseEngineCells(v: unknown, rows: number, cols: number): GoEngineCell[][] | null {
  if (!Array.isArray(v) || v.length !== rows) return null;
  const out: GoEngineCell[][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length !== cols) return null;
    const parsed: GoEngineCell[] = [];
    for (const cell of row) {
      const c = parseEngineCell(cell);
      if (!c) return null;
      parsed.push(c);
    }
    out.push(parsed);
  }
  return out;
}

/** Parse a gorates/v1 file. Missing or malformed `engine` / `engineCells` are dropped, not thrown. */
export function parseGoRates(raw: unknown): GoRatesFile {
  if (!isRecord(raw)) throw new Error("gorates: not an object");
  if (raw.schema !== "gorates/v1") throw new Error("gorates: unexpected schema");
  if (typeof raw.source !== "string" || typeof raw.builtAt !== "string" || typeof raw.dataThrough !== "string") {
    throw new Error("gorates: missing source stamps");
  }
  if (!Array.isArray(raw.seasons) || !raw.seasons.every((n) => typeof n === "number")) throw new Error("gorates: seasons");
  if (!isInt(raw.minPlays) || raw.maxFgYards !== 64) throw new Error("gorates: bounds");
  if (!Array.isArray(raw.distances) || !raw.distances.every(isInt) || raw.distances.length === 0) {
    throw new Error("gorates: distances");
  }
  if (!Array.isArray(raw.bands) || raw.bands.length === 0) throw new Error("gorates: bands");
  const bands: GoBand[] = [];
  for (const b of raw.bands) {
    const parsed = parseBand(b);
    if (!parsed) throw new Error("gorates: band");
    bands.push(parsed);
  }
  if (!Array.isArray(raw.cells) || raw.cells.length !== raw.distances.length) throw new Error("gorates: cells");
  const cells: GoCell[][] = [];
  for (const row of raw.cells) {
    if (!Array.isArray(row) || row.length !== bands.length) throw new Error("gorates: cell row");
    const parsedRow: GoCell[] = [];
    for (const cell of row) {
      const c = parseCell(cell);
      if (!c) throw new Error("gorates: cell");
      parsedRow.push(c);
    }
    cells.push(parsedRow);
  }
  const file: GoRatesFile = {
    schema: "gorates/v1",
    source: raw.source,
    builtAt: raw.builtAt,
    dataThrough: raw.dataThrough,
    seasons: raw.seasons as number[],
    minPlays: raw.minPlays,
    maxFgYards: 64,
    distances: raw.distances as number[],
    bands,
    cells,
  };
  const engine = parseEngineMeta(raw.engine);
  const engineCells = parseEngineCells(raw.engineCells, file.distances.length, file.bands.length);
  if (engine && engineCells) {
    file.engine = engine;
    file.engineCells = engineCells;
  }
  return file;
}

export const goRates = parseGoRates(raw);
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

export const MODEL_GO_LABEL = "Our model says go";
export const TEAMS_WENT_LABEL = "Teams went for it";

export type EngineLayerView = {
  modelGoPct: number;
  teamsWentPct: number;
  agreedPct: number | null;
  rated: number;
  plays: number;
  modelLabel: typeof MODEL_GO_LABEL;
  teamsLabel: typeof TEAMS_WENT_LABEL;
  summary: string;
  agreeLine: string | null;
};

/** Comparison for one cell. Null when the flag is off, the file has no engine, or the cell is too thin. */
export function engineLayer(
  file: GoRatesFile,
  row: number,
  col: number,
  enabled: boolean = CHECKER_ENABLED,
): EngineLayerView | null {
  if (!enabled || !file.engine || !file.engineCells) return null;
  const cell = file.cells[row]?.[col];
  const eng = file.engineCells[row]?.[col];
  if (!cell || !eng) return null;
  const [plays, went] = cell;
  const [rated, engineGo, , , , wentWhenEngineGo] = eng;
  if (plays < file.minPlays || rated <= 0) return null;
  const modelGoPct = pct(engineGo, rated);
  const teamsWentPct = pct(went, plays);
  const agreedPct = engineGo ? pct(wentWhenEngineGo, engineGo) : null;
  const summary = `${MODEL_GO_LABEL} on ${modelGoPct}% of these; ${TEAMS_WENT_LABEL.toLowerCase()} ${teamsWentPct}%.`;
  const agreeLine = agreedPct == null ? null : `When our model said go, teams went ${agreedPct}%.`;
  return {
    modelGoPct,
    teamsWentPct,
    agreedPct,
    rated,
    plays,
    modelLabel: MODEL_GO_LABEL,
    teamsLabel: TEAMS_WENT_LABEL,
    summary,
    agreeLine,
  };
}
