/**
 * Season years from committed data files (`YYYY.json`). Adding a season file
 * is enough; callers do not hard-code a first or last year.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

const YEAR_FILE = /^(\d{4})\.json$/;
const EN_DASH = "–";

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

function finiteYears(seasons: readonly number[]): number[] {
  return [...new Set(seasons.filter((y) => Number.isFinite(y)))];
}

/** Earliest and latest year present, ignoring order. Null when `seasons` is empty. */
export function seasonEnds(seasons: readonly number[]): [number, number] | null {
  const years = finiteYears(seasons);
  if (!years.length) return null;
  return [Math.min(...years), Math.max(...years)];
}

/** Closed range from the years present: "2019–2025" (en dash), one year, or "" when empty. Order does not matter. */
export function seasonRangeText(seasons: readonly number[]): string {
  const ends = seasonEnds(seasons);
  if (!ends) return "";
  const [first, last] = ends;
  return first === last ? String(first) : `${first}${EN_DASH}${last}`;
}

function contiguous(years: readonly number[]): boolean {
  if (years.length <= 1) return true;
  const sorted = [...years].sort((a, b) => a - b);
  return sorted[sorted.length - 1] - sorted[0] + 1 === sorted.length;
}

/**
 * Fan-facing coverage. A contiguous span is the closed range ("2019–2025").
 * A gap would make that range claim seasons that are not in the data, so the
 * copy says "since 2019" (the earliest year present) instead.
 */
export function seasonCoverageText(seasons: readonly number[]): string {
  const years = finiteYears(seasons);
  if (!years.length) return "";
  if (!contiguous(years)) return `since ${Math.min(...years)}`;
  return seasonRangeText(years);
}
