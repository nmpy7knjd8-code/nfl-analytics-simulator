import raw from "./site/fg_rates.json";

/** One distance band. Bands are inclusive and never go past maxYards (64). */
export type FgBand = { id: string; min: number; max: number };
/** [tries, made]. */
export type FgCount = [tries: number, made: number];
export type FgRatesFile = {
  schema: "fg_rates/v2";
  source: string;
  builtAt: string;
  seasons: number[];
  minYards: number;
  maxYards: 64;
  fewKicksBelow: number;
  /** Headline rate at yard Y pools tries from Y-smoothYards to Y+smoothYards (clamped to the range). */
  smoothYards: number;
  bands: FgBand[];
  /** Keys: "all" and one per season. One [tries, made] per yard, minYards..maxYards. */
  yards: Record<string, FgCount[]>;
};

export const fgRates = raw as unknown as FgRatesFile;
export const FG_MAX_YARDS = 64;
export const FG_MIN_YARDS = fgRates.minYards;

export type Rate = { tries: number; made: number; pct: number | null; few: boolean };
const rate = (file: FgRatesFile, tries: number, made: number): Rate =>
  ({ tries, made, pct: tries ? (100 * made) / tries : null, few: tries < file.fewKicksBelow });

function sumYards(file: FgRatesFile, key: string, lo: number, hi: number): Rate {
  const rows = file.yards[key] ?? [];
  let t = 0, m = 0;
  for (let y = Math.max(lo, file.minYards); y <= Math.min(hi, file.maxYards); y++) {
    const [ty, my] = rows[y - file.minYards] ?? [0, 0];
    t += ty; m += my;
  }
  return rate(file, t, m);
}

export type BandView = FgBand & Rate;
export function bandsFor(file: FgRatesFile, key: string): BandView[] {
  return file.bands.map((b) => ({ ...b, ...sumYards(file, key, b.min, b.max) }));
}

/** Smoothed make rate at one yard: all tries within ±smoothYards of it. */
export function rateAt(file: FgRatesFile, key: string, yards: number): Rate & { lo: number; hi: number } {
  const y = clampYards(yards);
  const lo = Math.max(y - file.smoothYards, file.minYards), hi = Math.min(y + file.smoothYards, file.maxYards);
  return { ...sumYards(file, key, lo, hi), lo, hi };
}

export const clampYards = (y: number) => Math.min(Math.max(y, FG_MIN_YARDS), FG_MAX_YARDS);

export function bandIndexFor(file: FgRatesFile, yards: number): number {
  const y = clampYards(yards);
  return file.bands.findIndex((b) => y >= b.min && y <= b.max);
}

export function bandLabel(b: FgBand): string {
  return b.min === 0 ? `Under ${b.max + 1}` : `${b.min}–${b.max}`;
}
