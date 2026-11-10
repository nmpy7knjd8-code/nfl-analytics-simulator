/**
 * D1 Comebacks: games won by a team whose win chance fell very low (comebacks/v1, Data & Models).
 * Regulation win chance only; overtime is named in words, never charted.
 */
import { gameWeekLabel } from "../playFeed";

export type ComebacksDoc = {
  schema: "comebacks/v1"; decided_games: number; season_list: number[]; lows: number[]; cols: string[]; top: unknown[][];
};
export type Comeback = {
  season: number; week: number; seasonType: "REG" | "POST"; gameId: string; winner: string; loser: string;
  winnerScore: number; loserScore: number; ot: boolean; low: number; lowQtr: number; lowClock: string; spark: number[];
};

const COLS = ["season", "week", "season_type", "game_id", "winner", "loser", "winner_score", "loser_score", "ot", "low", "low_qtr", "low_clock", "spark"];

export function isComebacksDoc(x: unknown): x is ComebacksDoc {
  const d = x as ComebacksDoc;
  return !!d && d.schema === "comebacks/v1" && Array.isArray(d.lows) && Array.isArray(d.top) && Array.isArray(d.cols)
    && COLS.every((c) => d.cols.includes(c));
}

export function rows(d: ComebacksDoc): Comeback[] {
  const i = (c: string) => d.cols.indexOf(c);
  return d.top.map((r) => ({
    season: r[i("season")] as number, week: r[i("week")] as number, seasonType: r[i("season_type")] as "REG" | "POST",
    gameId: r[i("game_id")] as string, winner: r[i("winner")] as string, loser: r[i("loser")] as string,
    winnerScore: r[i("winner_score")] as number, loserScore: r[i("loser_score")] as number, ot: !!r[i("ot")],
    low: r[i("low")] as number, lowQtr: r[i("low_qtr")] as number, lowClock: r[i("low_clock")] as string,
    spark: (r[i("spark")] as number[]) ?? [],
  }));
}

/** Games won after the winner fell below `cut` (default 5%). */
export const belowCount = (d: ComebacksDoc, cut = 0.05): number => d.lows.filter((l) => l < cut).length;

/** Lowest point, as a fan reads it: "<1%" instead of "0%". */
export function lowPct(low: number): string {
  const n = Math.round(low * 100);
  return n < 1 ? "<1%" : `${n}%`;
}

export const weekText = (c: Comeback): string => gameWeekLabel(c.season, c.week, c.seasonType);
export const scoreText = (c: Comeback): string => `${c.winner} ${c.winnerScore}, ${c.loser} ${c.loserScore}${c.ot ? " (won in overtime)" : ""}`;
const ORD = ["1st", "2nd", "3rd", "4th"];
/** "with 3:52 left", or "at the end of the 3rd quarter" when the clock reads 0:00 (QA C3). */
export function clockText(qtr: number, clock: string): string {
  return /^0?0:00$/.test(clock) ? `at the end of the ${ORD[qtr - 1] ?? `Q${qtr}`} quarter` : `with ${clock.replace(/^0(\d)/, "$1")} left`;
}
export const lowText = (c: Comeback): string =>
  /^0?0:00$/.test(c.lowClock) ? `${c.winner} fell to ${lowPct(c.low)} to win ${clockText(c.lowQtr, c.lowClock)}`
    : `${c.winner} fell to ${lowPct(c.low)} to win in Q${c.lowQtr} ${clockText(c.lowQtr, c.lowClock)}`;

/** Header: the full count for context, then how many are listed (QA C2: header said 65, list shows 50). */
export function headline(d: ComebacksDoc): string {
  const n = belowCount(d), shown = rows(d).length;
  const tail = shown < n ? ` Here are the ${shown} biggest.` : "";
  return `${n} teams came back from under 5% to win since ${d.season_list[0]}, out of ${d.decided_games.toLocaleString("en-US")} games.${tail}`;
}

/** Sparkline path (0..100 win chance for the winner, regulation only) in a w×h box. */
export function sparkPath(spark: number[], w: number, h: number): string {
  if (spark.length < 2) return "";
  return spark.map((v, k) => `${k ? "L" : "M"}${((k / (spark.length - 1)) * w).toFixed(1)},${(h - (Math.max(0, Math.min(100, v)) / 100) * h).toFixed(1)}`).join(" ");
}
