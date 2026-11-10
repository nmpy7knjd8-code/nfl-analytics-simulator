/**
 * Season years from committed data files (`2019.json`, …). Adding a new
 * season file is enough; nothing here hard-codes a range.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

const YEAR_FILE = /^(\d{4})\.json$/;

export const GAMES_DIR = join(process.cwd(), "public", "data", "games");
export const COACHES_DIR = join(process.cwd(), "public", "data", "coaches");

/** Years named by `YYYY.json` in `names`, oldest first (or newest first if `order` is `"desc"`). */
export function seasonsFromNames(names: readonly string[], order: "asc" | "desc" = "asc"): number[] {
  const years = [...new Set(names.flatMap((n) => {
    const m = YEAR_FILE.exec(n);
    return m ? [Number(m[1])] : [];
  }))];
  years.sort((a, b) => (order === "desc" ? b - a : a - b));
  return years;
}

export function seasonsFromDir(dir: string, order: "asc" | "desc" = "asc"): number[] {
  return seasonsFromNames(readdirSync(dir), order);
}

export function gameSeasons(order: "asc" | "desc" = "asc"): number[] {
  return seasonsFromDir(GAMES_DIR, order);
}

export function coachSeasons(order: "asc" | "desc" = "asc"): number[] {
  return seasonsFromDir(COACHES_DIR, order);
}

/** "2019–2025" (en dash), or a single year, from the seasons actually present. */
export function seasonRangeText(seasons: readonly number[]): string {
  if (!seasons.length) return "";
  const first = Math.min(...seasons);
  const last = Math.max(...seasons);
  return first === last ? String(first) : `${first}–${last}`;
}
