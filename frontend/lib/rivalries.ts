/**
 * G3 rivalry pages: every meeting between two teams, from the committed nflverse season indexes
 * (public/data/games/<season>.json, games_index.v1). Build-time only (node fs); no new data file.
 * The Raiders' 2019 games are listed as OAK in nflverse; they are grouped with LV here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import facts from "./gameFacts.json";
import colorsJson from "./teamColors.json";

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

// ---- Strip colors: each team's own color, readable on white ----
type TC = { primary: string; secondary: string; tertiary?: string };
const TEAM_COLORS = (colorsJson as { teams: Record<string, TC> }).teams;
export const FALLBACK = "#5f6368";

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function lum(h: string): number {
  const [r, g, b] = rgb(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Visible on the white card: not near-black (blends with the black text/borders) and not too pale (contrast >= 1.5). */
export const usable = (h: string) => lum(h) > 0.01 && 1.05 / (lum(h) + 0.05) >= 1.5;
const far = (x: string, y: string) => Math.hypot(...rgb(x).map((v, i) => v - rgb(y)[i])) >= 90;

/** Primary unless it is too dark (or pale) to see on white; then secondary, tertiary, then grey. B also avoids A's color. */
export function stripColors(a: string, b: string): [string, string] {
  const opts = (t: string) => { const c = TEAM_COLORS[t]; return c ? [c.primary, c.secondary, c.tertiary ?? ""].filter((h) => /^#[0-9a-f]{6}$/i.test(h) && usable(h)) : []; };
  const ca = opts(a)[0] ?? FALLBACK;
  const cb = opts(b).find((h) => far(h, ca)) ?? (far(FALLBACK, ca) ? FALLBACK : "#000000");
  return [ca, cb];
}

export type Rival = { opp: string; key: string; meetings: number; w: number; l: number; t: number };
/** Every opponent a team met 2019–2025, most meetings first; record from the team's side. */
export function teamRivals(team: string): Rival[] {
  const t = franchise(team);
  return allPairs()
    .filter((k) => k.split("-").includes(t))
    .map((k) => {
      const r = rivalry(k)!;
      const mine = r.a === t;
      return { opp: mine ? r.b : r.a, key: k, meetings: r.meetings.length, w: mine ? r.aWins : r.bWins, l: mine ? r.bWins : r.aWins, t: r.ties };
    })
    .sort((x, y) => y.meetings - x.meetings || x.opp.localeCompare(y.opp));
}
