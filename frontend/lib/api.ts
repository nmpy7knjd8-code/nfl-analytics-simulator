import type { CanonicalPlay, GameSummary } from "../contracts";

const API_BASE = process.env.NFL_SIM_API_ORIGIN ?? "http://127.0.0.1:8000";

export type GamesResponse = {
  items: GameSummary[];
  total: number;
  limit: number;
  offset: number;
  truth_label: "historical";
};

export type PlaysResponse = {
  game_id: string;
  items: CanonicalPlay[];
  total: number;
  limit: number;
  offset: number;
  truth_label: "historical";
  reference_disclaimer: string;
};

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export function fetchGames(season = 2023): Promise<GamesResponse> {
  return getJson(`/games?season=${season}&limit=500`);
}

export function fetchGame(gameId: string): Promise<GameSummary> {
  return getJson(`/games/${encodeURIComponent(gameId)}`);
}

export function fetchPlays(gameId: string): Promise<PlaysResponse> {
  return getJson(`/games/${encodeURIComponent(gameId)}/plays?limit=2000`);
}
