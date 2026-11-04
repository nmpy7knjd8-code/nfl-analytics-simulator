/** F7 drive strips: data/site/drives/{season}.json (drives/v1, Data Builders #246), copied byte-for-byte to public/data/drives/. */
export type TileCode = "T" | "F" | "G" | "N" | "X" | "K" | "Q";
export type DrivesFile = {
  schema: "drives/v1"; season: number; builtAt: string; dataThrough: string;
  tile_key: Record<TileCode, string>; result_key: Record<string, string>; cols: string[];
  games: Record<string, string[]>;
};
export type Drive = { team: string; qtr: number; clock: string; yards: number; result: string; tiles: TileCode[] };

export const TILE_ORDER: TileCode[] = ["T", "F", "G", "N", "X", "K", "Q"];
/** Fan words for each tile; no model numbers. */
export const TILE_LABEL: Record<TileCode, string> = {
  T: "Touchdown", F: "First down", G: "Gain", N: "No gain or loss", X: "Turnover", K: "Kick", Q: "Kneel or spike",
};
export const RESULT_LABEL: Record<string, string> = {
  TD: "Touchdown", FG: "Field goal", P: "Punt", TO: "Turnover", DN: "Turnover on downs",
  MF: "Missed field goal", EH: "End of half", OT: "Other team scored", OD: "Other team scored", SF: "Safety",
};

export function drivesUrl(season: number, basePath = ""): string {
  return `${basePath}/data/drives/${season}.json`;
}

export function isDrivesFile(x: unknown): x is DrivesFile {
  const d = x as DrivesFile;
  return !!d && d.schema === "drives/v1" && typeof d.games === "object" && Array.isArray(d.cols);
}

/** "ARI 1 15:00 70 TD GFGT" -> Drive. Returns null for a malformed string. */
export function parseDrive(s: string): Drive | null {
  const m = /^([A-Z]{2,3}) (\d) (\d\d:\d\d) (-?\d+) ([A-Z]{1,2}) ([TFGNXKQ]+)$/.exec(s);
  if (!m) return null;
  return { team: m[1], qtr: Number(m[2]), clock: m[3], yards: Number(m[4]), result: m[5], tiles: m[6].split("") as TileCode[] };
}

export function gameDrives(f: DrivesFile, gameId: string): Drive[] {
  return (f.games[gameId] ?? []).map(parseDrive).filter((d): d is Drive => d !== null);
}

export const qtrLabel = (q: number) => (q > 4 ? "OT" : `Q${q}`);
export const resultLabel = (r: string, qtr = 0) => (r === "EH" && qtr >= 4 ? "End of game" : RESULT_LABEL[r] ?? r);
export const yardsLabel = (y: number) => `${y} ${Math.abs(y) === 1 ? "yard" : "yards"}`;
export const playsLabel = (n: number) => `${n} ${n === 1 ? "play" : "plays"}`;

/** Screen-reader line for one strip. */
export function driveAria(d: Drive, name: (abbr: string) => string): string {
  return `${name(d.team)} drive, ${qtrLabel(d.qtr)} ${d.clock}: ${playsLabel(d.tiles.length)}, ${yardsLabel(d.yards)}, ${resultLabel(d.result, d.qtr)}`;
}
