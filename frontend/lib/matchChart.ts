/** matchcharts/v1: one regulation-only home win-chance chart per game (60 points, one per game minute). */
export type ChartGame = {
  gameId: string; week: number; seasonType: string; home: string; away: string;
  homeScore: number; awayScore: number; ot: boolean; wp: number[];
};
export type ChartsFile = { schema: "matchcharts/v1"; stub?: boolean; season: number; builtAt: string; points: number; games: ChartGame[] };

export const LETTERS = ["A", "B", "C"] as const;

/** Small seeded PRNG so a day's puzzle is the same for everyone. */
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/** Pick 3 games with different final margins' shapes; charts order and matchup order are shuffled separately. */
export function makeRound(file: ChartsFile, seed: string): { games: ChartGame[]; chartOrder: number[] } {
  const r = rng(seed);
  const pool = file.games.filter((g) => g.wp.length === file.points);
  const picked: ChartGame[] = [];
  while (picked.length < 3 && picked.length < pool.length) {
    const g = pool[Math.floor(r() * pool.length)];
    if (!picked.includes(g)) picked.push(g);
  }
  const chartOrder = [0, 1, 2].slice(0, picked.length);
  for (let i = chartOrder.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [chartOrder[i], chartOrder[j]] = [chartOrder[j], chartOrder[i]];
  }
  return { games: picked, chartOrder };
}

/** guesses[gameIndex] = chart slot picked; correct when chartOrder[slot] === gameIndex. */
export function score(chartOrder: number[], guesses: (number | null)[]): boolean[] {
  return guesses.map((slot, gi) => slot !== null && chartOrder[slot] === gi);
}
