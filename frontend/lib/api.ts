import type { CanonicalPlay, GameSummary } from "../contracts";
import {
  FIXTURE_BANNER,
  FIXTURE_GAMES,
  fixtureGame,
  fixturePlays,
} from "./fixtures";

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

export type DataSource = "live" | "example";

export type Sourced<T> = {
  data: T;
  source: DataSource;
  banner?: string;
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

export async function fetchGames(season = 2023): Promise<Sourced<GamesResponse>> {
  try {
    const data = await getJson<GamesResponse>(`/games?season=${season}&limit=500`);
    return { data, source: "live" };
  } catch {
    return { data: FIXTURE_GAMES, source: "example", banner: FIXTURE_BANNER };
  }
}

export async function fetchGame(gameId: string): Promise<Sourced<GameSummary>> {
  try {
    const data = await getJson<GameSummary>(`/games/${encodeURIComponent(gameId)}`);
    return { data, source: "live" };
  } catch {
    const data = fixtureGame(gameId);
    if (!data) throw new Error(`Game not found: ${gameId}`);
    return { data, source: "example", banner: FIXTURE_BANNER };
  }
}

export async function fetchPlays(gameId: string): Promise<Sourced<PlaysResponse>> {
  try {
    const data = await getJson<PlaysResponse>(
      `/games/${encodeURIComponent(gameId)}/plays?limit=2000`,
    );
    return { data, source: "live" };
  } catch {
    const data = fixturePlays(gameId);
    if (!data) throw new Error(`Plays not found: ${gameId}`);
    return { data, source: "example", banner: FIXTURE_BANNER };
  }
}

/** Future hook — sibling agent may add real fourth-down scoring on another branch. */
export const FOURTH_DOWN_API_PATH = "/models/fourth-down";
