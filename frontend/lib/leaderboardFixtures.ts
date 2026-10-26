/** EXAMPLE data — made-up handles and numbers, not real players or real picks. */
import type { QuizChoice } from "./quiz";
import type { QuizLeaderboardRow } from "./leaderboardApi";

export function fixtureLeaderboardRows(): QuizLeaderboardRow[] {
  return [
    { handle: "Audible-1187", score: 3, streak: 12 },
    { handle: "Redzone-0420", score: 2.5, streak: 7 },
    { handle: "Gunner-3301", score: 2, streak: 3 },
    { handle: "Nickel-7765", score: 1.5, streak: 1 },
    { handle: "Hashmark-0042", score: 1, streak: 0 },
  ];
}

/** EXAMPLE crowd picks per situation id (shares sum to 1). Not real player data. */
export const EXAMPLE_CROWD_PICKS: Record<string, Record<QuizChoice, number>> = {
  "flip-lac-den": { go: 0.22, fg: 0.31, punt: 0.47 },
  "anchor-bal-nyj": { go: 0.41, fg: 0.38, punt: 0.21 },
  "synth-midfield-go": { go: 0.36, fg: 0.09, punt: 0.55 },
  "synth-near-tie": { go: 0.44, fg: 0.33, punt: 0.23 },
  "synth-own-field-go": { go: 0.29, fg: 0.04, punt: 0.67 },
  "synth-fg-range": { go: 0.27, fg: 0.61, punt: 0.12 },
};
