/**
 * Game picker for the Play feed: season → week → game, plus a quick team search.
 * Reads the committed season indexes (/data/games/<season>.json, games_index.v1).
 */
import { teamNickname } from "./teams";

export const SEASONS = [2025, 2024, 2023, 2022, 2021, 2020, 2019] as const;
export const DEFAULT_FEED_GAME = "2023_01_DET_KC";

export type IndexGame = {
  id: string; season: number; week: number; season_type: string; date?: string;
  home: string; away: string; home_score: number | null; away_score: number | null; overtime?: boolean;
};
export type SeasonIndex = { schema_version: "games_index.v1"; season: number; games: IndexGame[] };

export function seasonIndexUrl(season: number, basePath = ""): string {
  return `${basePath}/data/games/${season}.json`;
}

export function isSeasonIndex(x: unknown): x is SeasonIndex {
  const d = x as Partial<SeasonIndex> | null;
  return !!d && d.schema_version === "games_index.v1" && Array.isArray(d.games);
}

const ROUNDS = ["Wild Card", "Divisional", "Conference", "Super Bowl"];
export type Week = { week: number; label: string; short: string };

/** Every regular-season week up to the last one in the index (a gap shows as an empty week), then the playoff rounds.
 * Playoff week numbers differ by season (2020: 18–21, 2021+: 19–22), so rounds are named by order, not number. */
export function weeksOf(games: IndexGame[]): Week[] {
  const reg = games.filter((g) => g.season_type !== "POST").map((g) => g.week);
  const last = reg.length ? Math.max(...reg) : 0;
  const post = [...new Set(games.filter((g) => g.season_type === "POST").map((g) => g.week))].sort((a, b) => a - b);
  const off = ROUNDS.length - post.length;
  return [
    ...Array.from({ length: last }, (_, i) => ({ week: i + 1, label: `Week ${i + 1}`, short: String(i + 1) })),
    ...post.map((w, i) => ({ week: w, label: ROUNDS[i + off] ?? `Week ${w}`, short: ROUNDS[i + off] ?? String(w) })),
  ];
}

export function gamesInWeek(games: IndexGame[], week: number): IndexGame[] {
  return games.filter((g) => g.week === week).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
}

/** Quick team search: abbreviation ("KC") or nickname ("chiefs"), case-insensitive, in week order. */
export function searchGames(games: IndexGame[], q: string): IndexGame[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const hit = (t: string) => t.toLowerCase() === s || teamNickname(t).toLowerCase().includes(s);
  return games.filter((g) => hit(g.home) || hit(g.away)).sort((a, b) => a.week - b.week);
}

export function matchup(g: Pick<IndexGame, "home" | "away">): string {
  return `${g.away} @ ${g.home}`;
}

/** "20–24 Final" (away first, like the matchup), "Final/OT", or "Not played yet". */
export function finalScore(g: IndexGame): string {
  if (g.home_score == null || g.away_score == null) return "Not played yet";
  return `${g.away_score}–${g.home_score} ${g.overtime ? "Final/OT" : "Final"}`;
}

const ID = /^(20\d\d)_(\d\d)_([A-Z]{2,3})_([A-Z]{2,3})$/;
/** ?game=<id> from a query string; anything malformed falls back to the default game. */
export function gameFromQuery(search: string): string {
  const id = new URLSearchParams(search).get("game")?.trim() ?? "";
  return ID.test(id) ? id : DEFAULT_FEED_GAME;
}
export function seasonOf(id: string): number {
  return Number(id.slice(0, 4));
}
export function feedHref(id: string, basePath = ""): string {
  return `${basePath}/feed/?game=${encodeURIComponent(id)}`;
}
/** URL to write so the address bar always names the game (also the default one), or null if it already does. */
export function feedUrlToWrite(current: string, id: string, basePath = ""): string | null {
  const href = feedHref(id, basePath);
  return current === href ? null : href;
}
