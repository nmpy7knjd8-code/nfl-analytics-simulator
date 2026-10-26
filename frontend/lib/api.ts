import { API_ENDPOINTS, type CanonicalPlay, type GameSummary, type WinProbabilitySeries } from "../contracts";
import type { ChartSeries } from "./winProbability";
import { fixtureWinProbability } from "./wpFixtures";
import {
  FIXTURE_BANNER,
  FIXTURE_GAMES,
  fixtureGame,
  fixturePlays,
} from "./fixtures";

const API_BASE = process.env.NFL_SIM_API_ORIGIN ?? "http://127.0.0.1:8000";
/** Static Pages / offline demo — never call the API (fixtures only). */
const DEMO_ONLY =
  process.env.NFL_SIM_STATIC_EXPORT === "1" || process.env.NFL_SIM_DEMO_ONLY === "1";

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
    signal: AbortSignal.timeout(800),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${path}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchGames(season = 2023): Promise<Sourced<GamesResponse>> {
  if (DEMO_ONLY) {
    return { data: FIXTURE_GAMES, source: "example", banner: FIXTURE_BANNER };
  }
  try {
    const data = await getJson<GamesResponse>(`/games?season=${season}&limit=500`);
    return { data, source: "live" };
  } catch {
    return { data: FIXTURE_GAMES, source: "example", banner: FIXTURE_BANNER };
  }
}

export async function fetchGame(gameId: string): Promise<Sourced<GameSummary>> {
  if (!DEMO_ONLY) {
    try {
      const data = await getJson<GameSummary>(`/games/${encodeURIComponent(gameId)}`);
      return { data, source: "live" };
    } catch {
      /* fall through to fixtures */
    }
  }
  const data = fixtureGame(gameId);
  if (!data) throw new Error(`Game not found: ${gameId}`);
  return { data, source: "example", banner: FIXTURE_BANNER };
}

export async function fetchPlays(gameId: string): Promise<Sourced<PlaysResponse>> {
  if (!DEMO_ONLY) {
    try {
      const data = await getJson<PlaysResponse>(
        `/games/${encodeURIComponent(gameId)}/plays?limit=2000`,
      );
      return { data, source: "live" };
    } catch {
      /* fall through to fixtures */
    }
  }
  const data = fixturePlays(gameId);
  if (!data) throw new Error(`Plays not found: ${gameId}`);
  return { data, source: "example", banner: FIXTURE_BANNER };
}

/**
 * GET /games/{id}/win-probability (contract: WinProbabilitySeries). Falls back to the
 * labeled example fixture when the API is unavailable. Never derived from reference.wp.
 */
export async function fetchWinProbability(gameId: string): Promise<ChartSeries | null> {
  if (!DEMO_ONLY) {
    try {
      const series = await getJson<WinProbabilitySeries>(API_ENDPOINTS.winProbability(gameId));
      return { series, origin: "live", note: "Win chance from nflverse play-by-play (home team)." };
    } catch {
      /* fall through to fixtures */
    }
  }
  return fixtureWinProbability(gameId);
}

/** Future hook — sibling agent may add real fourth-down scoring on another branch. */
export const FOURTH_DOWN_API_PATH = "/models/fourth-down";
