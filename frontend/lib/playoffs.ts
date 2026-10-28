/**
 * G2 playoff bracket, from the committed nflverse season indexes (public/data/games/<season>.json).
 * Build-time only. No seeds anywhere (house rule: no seeds before January; nflverse has no seed field).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import facts from "./gameFacts.json";

export const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025] as const;

/** Conference by franchise (nflverse teams.team_conf). OAK = the Raiders in 2019. Checked against every playoff pairing in tests. */
export const CONF: Record<string, "AFC" | "NFC"> = Object.fromEntries([
  ..."BAL BUF CIN CLE DEN HOU IND JAX KC LAC LV OAK MIA NE NYJ PIT TEN".split(" ").map((t) => [t, "AFC"]),
  ..."ARI ATL CAR CHI DAL DET GB LA MIN NO NYG PHI SEA SF TB WAS".split(" ").map((t) => [t, "NFC"]),
]);

type IndexGame = { id: string; season: number; season_type: string; game_type: string; date: string; home: string; away: string; home_score: number; away_score: number; overtime: boolean };
export type PGame = { id: string; date: string; home: string; away: string; home_score: number; away_score: number; overtime: boolean; winner: string; conf: "AFC" | "NFC" | null; story: boolean };
export type Round = { key: "WC" | "DIV" | "CON" | "SB"; name: string; games: PGame[] };
export type Bracket = { season: number; sbNumber: string; champion: string; rounds: Round[] };

const ROUND_NAME = { WC: "Wild Card", DIV: "Divisional", CON: "Conference finals", SB: "Super Bowl" } as const;
const STORIES = new Set((facts as { games: { game_id: string }[] }).games.map((g) => g.game_id));

export function roman(n: number): string {
  const t: [number, string][] = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let s = "";
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}

export function bracket(season: number, dir = join(process.cwd(), "public", "data", "games")): Bracket {
  const games = (JSON.parse(readFileSync(join(dir, `${season}.json`), "utf8")) as { games: IndexGame[] }).games.filter((g) => g.season_type === "POST");
  const rounds = (Object.keys(ROUND_NAME) as Round["key"][]).map((key) => ({
    key,
    name: ROUND_NAME[key],
    games: games
      .filter((g) => g.game_type === key)
      .map((g) => ({
        id: g.id, date: g.date, home: g.home, away: g.away, home_score: g.home_score, away_score: g.away_score, overtime: g.overtime,
        winner: g.home_score > g.away_score ? g.home : g.away,
        conf: key === "SB" ? null : CONF[g.home],
        story: STORIES.has(g.id),
      }))
      .sort((a, b) => (a.conf ?? "").localeCompare(b.conf ?? "") || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
  }));
  const sb = rounds[3].games[0];
  return { season, sbNumber: roman(season - 1965), champion: sb.winner, rounds };
}
