/**
 * G3 rivalry pages: every meeting between two teams, from the committed nflverse season indexes
 * (public/data/games/<season>.json, games_index.v1). Build-time only (node fs); no new data file.
 * The Raiders' 2019 games are listed as OAK in nflverse; they are grouped with LV here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import facts from "./gameFacts.json";

export const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;
const ALIAS: Record<string, string> = { OAK: "LV" };
export const franchise = (t: string) => ALIAS[t] ?? t;

type IndexGame = {
  id: string; season: number; week: number; season_type: string; game_type: string; date: string;
  home: string; away: string; home_score: number; away_score: number; overtime: boolean;
};

export type Meeting = {
  id: string; season: number; week: number; round: string; date: string;
  home: string; away: string; home_score: number; away_score: number; overtime: boolean;
  winner: string | null; story: boolean;
};

export type Rivalry = { a: string; b: string; meetings: Meeting[]; aWins: number; bWins: number; ties: number; aPts: number; bPts: number };

const ROUND: Record<string, string> = { WC: "Wild Card", DIV: "Divisional", CON: "Conference final", SB: "Super Bowl" };
const STORIES = new Set((facts as { games: { game_id: string }[] }).games.map((g) => g.game_id));

let cache: IndexGame[] | null = null;
export function allGames(dir = join(process.cwd(), "public", "data", "games")): IndexGame[] {
  if (cache) return cache;
  cache = SEASONS.flatMap((s) => (JSON.parse(readFileSync(join(dir, `${s}.json`), "utf8")) as { games: IndexGame[] }).games);
  return cache;
}

/** Canonical URL key: the two codes in alphabetical order, e.g. "BUF-KC". */
export const pairKey = (x: string, y: string) => [franchise(x), franchise(y)].sort().join("-");

export function allPairs(): string[] {
  return [...new Set(allGames().map((g) => pairKey(g.home, g.away)))].sort();
}

export function rivalry(key: string): Rivalry | null {
  const [a, b] = key.split("-");
  if (!a || !b) return null;
  const games = allGames().filter((g) => pairKey(g.home, g.away) === key).sort((x, y) => x.date.localeCompare(y.date));
  if (!games.length) return null;
  const r: Rivalry = { a, b, meetings: [], aWins: 0, bWins: 0, ties: 0, aPts: 0, bPts: 0 };
  for (const g of games) {
    const home = franchise(g.home), away = franchise(g.away);
    const winner = g.home_score === g.away_score ? null : g.home_score > g.away_score ? home : away;
    if (winner === a) r.aWins++; else if (winner === b) r.bWins++; else r.ties++;
    r.aPts += home === a ? g.home_score : g.away_score;
    r.bPts += home === b ? g.home_score : g.away_score;
    r.meetings.push({
      id: g.id, season: g.season, week: g.week, date: g.date, home, away,
      round: g.season_type === "POST" ? ROUND[g.game_type] ?? "Playoffs" : `Week ${g.week}`,
      home_score: g.home_score, away_score: g.away_score, overtime: g.overtime, winner, story: STORIES.has(g.id),
    });
  }
  return r;
}

/** "Bills lead 5–3" style series line, using the codes; the page swaps in nicknames. */
export function seriesLine(r: Rivalry, name: (t: string) => string): string {
  const t = r.ties ? `–${r.ties}` : "";
  if (r.aWins === r.bWins) return `Series tied ${r.aWins}–${r.bWins}${t}`;
  const [lead, w, l] = r.aWins > r.bWins ? [r.a, r.aWins, r.bWins] : [r.b, r.bWins, r.aWins];
  return `${name(lead)} lead ${w}–${l}${t}`;
}
