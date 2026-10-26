/**
 * PROPOSED contract for NFL Data & Models — not in frontend/contracts yet.
 *
 *   GET /quiz/leaderboard?date=YYYY-MM-DD   (date = New York quiz day)
 *   200 → QuizLeaderboardRow[]  sorted by score desc
 *
 * Until the endpoint exists, `fetchLeaderboard` returns the example fixture.
 */
import { fixtureLeaderboardRows } from "./leaderboardFixtures";

export type QuizLeaderboardRow = {
  /** Anonymous handle, e.g. "Pylon-4821". */
  handle: string;
  /** Points for that day: right call = 1, near-tie = 0.5. */
  score: number;
  /** Current daily streak in days. */
  streak: number;
};

export type QuizLeaderboardResponse = QuizLeaderboardRow[];

export const LEADERBOARD_PATH = "/quiz/leaderboard";

export function leaderboardUrl(date: string): string {
  return `${LEADERBOARD_PATH}?date=${encodeURIComponent(date)}`;
}

export type Leaderboard = {
  date: string;
  rows: QuizLeaderboardResponse;
  /** "example" = fixture, never real players. */
  source: "example" | "live";
};

/** Stub: no network call yet. Swap the body for fetch(leaderboardUrl(date)) later. */
export async function fetchLeaderboard(date: string): Promise<Leaderboard> {
  return { date, rows: fixtureLeaderboardRows(), source: "example" };
}

export type RankedRow = QuizLeaderboardRow & { rank: number; is_you: boolean };

/** Insert the local player and rank by score, then streak, then handle. */
export function rankWithYou(
  rows: QuizLeaderboardResponse,
  you: QuizLeaderboardRow | null,
): RankedRow[] {
  const all: RankedRow[] = rows
    .filter((r) => !you || r.handle !== you.handle)
    .map((r) => ({ ...r, rank: 0, is_you: false }));
  if (you) all.push({ ...you, rank: 0, is_you: true });
  all.sort((a, b) => b.score - a.score || b.streak - a.streak || a.handle.localeCompare(b.handle));
  all.forEach((r, i) => (r.rank = i + 1));
  return all;
}
