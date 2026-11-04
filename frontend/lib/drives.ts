/** F7 drive strips: data/site/drives/{season}.json (drives/v1, Data Builders #246), copied byte-for-byte to public/data/drives/. */
export type TileCode = "T" | "F" | "G" | "N" | "X" | "K" | "Q";
export type DrivesFile = {
  schema: "drives/v1"; season: number; builtAt: string; dataThrough: string;
  tile_key: Record<TileCode, string>; result_key: Record<string, string>; cols: string[];
  games: Record<string, string[]>;
};
export type Drive = { team: string; qtr: number; clock: string; yards: number; result: string; tiles: TileCode[]; ret?: RetCode };
/** OD drives only: how the opponent scored (data ret_key). I pick-six, F fumble return, B blocked kick, P punt return, K kickoff return, M missed FG return, - other. */
export type RetCode = "I" | "F" | "B" | "P" | "K" | "M" | "-";

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
  const m = /^([A-Z]{2,3}) (\d) (\d\d:\d\d) (-?\d+) ([A-Z]{1,2}) ([TFGNXKQ]+)(?: ([IFBPKM-]))?$/.exec(s);
  if (!m) return null;
  const d: Drive = { team: m[1], qtr: Number(m[2]), clock: m[3], yards: Number(m[4]), result: m[5], tiles: m[6].split("") as TileCode[] };
  if (m[7]) d.ret = m[7] as RetCode;
  return d;
}

export function gameDrives(f: DrivesFile, gameId: string): Drive[] {
  return (f.games[gameId] ?? []).map(parseDrive).filter((d): d is Drive => d !== null);
}

export const qtrLabel = (q: number) => (q > 4 ? "OT" : `Q${q}`);
/**
 * Drive result in fan words. For an opponent touchdown (OD, formerly OT) the drive's last tile says how:
 * X = the offense turned it over and it was returned for a TD; K = a special teams TD (punt or kick try returned).
 * The data can't tell an interception from a fumble, or a punt from a blocked field goal, so we stop there.
 */
export function resultLabel(r: string, qtr = 0, last?: TileCode): string {
  if (r === "EH" && qtr >= 4) return "End of game";
  if (r === "OD" || r === "OT") return last === "X" ? "Turnover returned for TD" : last === "K" ? "Special teams TD" : "Other team scored";
  return RESULT_LABEL[r] ?? r;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2024-02-11" -> "Feb 11, 2024" (read as a calendar date, no time zone shift). */
export function humanDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : iso;
}
export const seasonNote = (dataThrough: string) => `Season data through ${humanDate(dataThrough)}.`;
export const yardsLabel = (y: number) => `${y} ${Math.abs(y) === 1 ? "yard" : "yards"}`;
export const playsLabel = (n: number) => `${n} ${n === 1 ? "play" : "plays"}`;

/** Screen-reader line for one strip. */
export function driveAria(d: Drive, name: (abbr: string) => string): string {
  return `${name(d.team)} drive, ${qtrLabel(d.qtr)} ${d.clock}: ${playsLabel(d.tiles.length)}, ${yardsLabel(d.yards)}, ${resultLabel(d.result, d.qtr, d.tiles[d.tiles.length - 1])}`;
}
