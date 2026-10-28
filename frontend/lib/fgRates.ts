import raw from "./site/fg_rates.json";

/** One distance band. Bands are inclusive and never go past maxYards (64). */
export type FgBand = { id: string; min: number; max: number };
/** [tries, made] per band, same order as `bands`. */
export type FgCount = [tries: number, made: number];
export type FgRatesFile = {
  schema: "fg_rates/v1";
  stub?: boolean;
  source: string;
  builtAt: string;
  seasons: number[];
  maxYards: 64;
  fewKicksBelow: number;
  bands: FgBand[];
  /** Keys: "all" (every season in the data) and one per season, e.g. "2019". */
  rates: Record<string, FgCount[]>;
};

export const fgRates = raw as unknown as FgRatesFile;
export const FG_MAX_YARDS = 64;
export const FG_MIN_YARDS = 18;

export type BandView = FgBand & { tries: number; made: number; pct: number | null; few: boolean };

export function bandsFor(file: FgRatesFile, key: string): BandView[] {
  const counts = file.rates[key] ?? [];
  return file.bands.map((b, i) => {
    const [tries, made] = counts[i] ?? [0, 0];
    return { ...b, tries, made, pct: tries ? (100 * made) / tries : null, few: tries < file.fewKicksBelow };
  });
}

export function bandIndexFor(file: FgRatesFile, yards: number): number {
  const y = Math.min(Math.max(yards, FG_MIN_YARDS), FG_MAX_YARDS);
  return file.bands.findIndex((b) => y >= b.min && y <= b.max);
}

export function bandLabel(b: FgBand): string {
  return b.min === 0 ? `Under ${b.max + 1}` : `${b.min}–${b.max}`;
}
