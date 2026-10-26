/** EXAMPLE leaderboard — made-up names and scores, not real players. */
import type { LeaderboardResponse } from "./dailyQuiz";

export function fixtureLeaderboard(date: string): LeaderboardResponse {
  return {
    period: "daily",
    date,
    source: "example",
    source_note: "Example leaderboard — sample players, not real results.",
    entries: [
      { rank: 1, display_name: "FourthAndGo", points: 3, current_streak: 12 },
      { rank: 2, display_name: "RedZoneRita", points: 2.5, current_streak: 7 },
      { rank: 3, display_name: "PuntGod", points: 2, current_streak: 3 },
      { rank: 4, display_name: "TwoMinuteDrill", points: 1.5, current_streak: 1 },
      { rank: 5, display_name: "CoffinCorner", points: 1, current_streak: 0 },
    ],
  };
}
