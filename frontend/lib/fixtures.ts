/**
 * Demo fixtures so the fan UI runs without a live API / lake.
 * Clearly labeled example data — not live model output.
 */

import type { CanonicalPlay, GameSummary } from "../contracts";
import type { GamesResponse, PlaysResponse } from "./api";

export const FIXTURE_BANNER =
  "Example data — not live. Shows how the product will feel once the API is connected.";

export const FIXTURE_GAMES: GamesResponse = {
  items: [
    {
      game_id: "2023_01_DET_KC",
      league: "NFL",
      season: 2023,
      week: 1,
      season_type: "REG",
      game_date: "2023-09-07",
      home_team_id: "KC",
      away_team_id: "DET",
      home_score: 21,
      away_score: 20,
      stadium: "GEHA Field at Arrowhead Stadium",
    },
    {
      game_id: "2023_02_BUF_NYJ",
      league: "NFL",
      season: 2023,
      week: 2,
      season_type: "REG",
      game_date: "2023-09-17",
      home_team_id: "NYJ",
      away_team_id: "BUF",
      home_score: 22,
      away_score: 16,
      stadium: "MetLife Stadium",
    },
    {
      game_id: "2023_03_PHI_TB",
      league: "NFL",
      season: 2023,
      week: 3,
      season_type: "REG",
      game_date: "2023-09-25",
      home_team_id: "TB",
      away_team_id: "PHI",
      home_score: 11,
      away_score: 25,
      stadium: "Raymond James Stadium",
    },
  ],
  total: 3,
  limit: 500,
  offset: 0,
  truth_label: "historical",
};

const DET_KC_PLAYS: CanonicalPlay[] = [
  {
    play_id: "1",
    game_id: "2023_01_DET_KC",
    play_index: 1,
    quarter: 1,
    half_seconds_remaining: 1800,
    down: null,
    distance: null,
    yardline_100: 35,
    possession_team_id: "KC",
    play_type: "kickoff",
    description: "Kickoff — Harrison Butker kicks to Detroit 8. Returned to Detroit 28.",
    yards_gained: 0,
  },
  {
    play_id: "2",
    game_id: "2023_01_DET_KC",
    play_index: 2,
    quarter: 1,
    half_seconds_remaining: 1794,
    down: 1,
    distance: 10,
    yardline_100: 72,
    possession_team_id: "DET",
    play_type: "pass",
    description: "Jared Goff pass short middle to Amon-Ra St. Brown for 8 yards.",
    yards_gained: 8,
    reference: { wp: 0.48, ep: 1.1 },
  },
  {
    play_id: "3",
    game_id: "2023_01_DET_KC",
    play_index: 3,
    quarter: 1,
    half_seconds_remaining: 1752,
    down: 2,
    distance: 2,
    yardline_100: 64,
    possession_team_id: "DET",
    play_type: "rush",
    description: "David Montgomery right tackle for 3 yards (first down).",
    yards_gained: 3,
    reference: { wp: 0.5, ep: 1.4 },
  },
  {
    play_id: "4",
    game_id: "2023_01_DET_KC",
    play_index: 4,
    quarter: 2,
    half_seconds_remaining: 120,
    down: 4,
    distance: 1,
    yardline_100: 38,
    possession_team_id: "DET",
    play_type: "rush",
    description:
      "Fourth-and-1 — Detroit goes for it. Montgomery short gain; first down.",
    yards_gained: 2,
    reference: { wp: 0.55, ep: 2.2 },
  },
  {
    play_id: "5",
    game_id: "2023_01_DET_KC",
    play_index: 5,
    quarter: 4,
    half_seconds_remaining: 45,
    down: 3,
    distance: 7,
    yardline_100: 28,
    possession_team_id: "KC",
    play_type: "pass",
    description: "Patrick Mahomes pass incomplete. Detroit will get the ball back.",
    yards_gained: 0,
    reference: { wp: 0.62, ep: 2.8 },
  },
  {
    play_id: "6",
    game_id: "2023_01_DET_KC",
    play_index: 6,
    quarter: 4,
    half_seconds_remaining: 0,
    down: null,
    distance: null,
    yardline_100: null,
    possession_team_id: "DET",
    play_type: "other",
    description: "Final — Chiefs 21, Lions 20.",
    yards_gained: 0,
    reference: { wp: 1.0 },
  },
];

export function fixtureGame(gameId: string): GameSummary | null {
  return FIXTURE_GAMES.items.find((g) => g.game_id === gameId) ?? null;
}

export function fixturePlays(gameId: string): PlaysResponse | null {
  const game = fixtureGame(gameId);
  if (!game) return null;
  const items =
    gameId === "2023_01_DET_KC"
      ? DET_KC_PLAYS
      : [
          {
            play_id: "1",
            game_id: gameId,
            play_index: 1,
            quarter: 1,
            half_seconds_remaining: 1800,
            down: 1,
            distance: 10,
            yardline_100: 75,
            possession_team_id: game.away_team_id,
            play_type: "pass" as const,
            description: `Opening drive sample play for ${game.away_team_id} @ ${game.home_team_id}.`,
            yards_gained: 6,
            reference: { wp: 0.47, ep: 0.9 },
          },
          {
            play_id: "2",
            game_id: gameId,
            play_index: 2,
            quarter: 4,
            half_seconds_remaining: 0,
            down: null,
            distance: null,
            yardline_100: null,
            possession_team_id: game.home_team_id,
            play_type: "other" as const,
            description: `Final — ${game.away_team_id} ${game.away_score}, ${game.home_team_id} ${game.home_score}.`,
            yards_gained: 0,
          },
        ];
  return {
    game_id: gameId,
    items,
    total: items.length,
    limit: 2000,
    offset: 0,
    truth_label: "historical",
    reference_disclaimer:
      "Example reference columns for demo only. Not live model output from this repository.",
  };
}

/** Plain-English fourth-down scenario for the fan explainer (mock until API lands). */
export type FourthDownChoice = "go" | "fg" | "punt";

export type FourthDownOption = {
  id: FourthDownChoice;
  label: string;
  shortLabel: string;
  /** Estimated chance the offense still wins after this choice (0–1). */
  winChance: number;
  whatUsuallyHappens: string;
  plainResult: string;
};

export type FourthDownScenario = {
  id: string;
  title: string;
  setup: string;
  /** Hook for future POST /models/fourth-down once sibling API exists. */
  apiHook: string;
  situation: {
    offense: string;
    defense: string;
    down: number;
    distance: number;
    yardline_100: number;
    quarter: number;
    clock: string;
    scoreOffense: number;
    scoreDefense: number;
  };
  options: FourthDownOption[];
  footnote: string;
};

export const FOURTH_DOWN_SCENARIOS: FourthDownScenario[] = [
  {
    id: "demo-4th-1",
    title: "Fourth-and-short near midfield",
    setup:
      "Your team is down by a field goal late in the third. It’s 4th and 1 from the opponent’s 42.",
    apiHook: "POST /models/fourth-down (not on main yet — using example numbers)",
    situation: {
      offense: "DET",
      defense: "KC",
      down: 4,
      distance: 1,
      yardline_100: 42,
      quarter: 3,
      clock: "4:12",
      scoreOffense: 17,
      scoreDefense: 20,
    },
    options: [
      {
        id: "go",
        label: "Go for it",
        shortLabel: "Go",
        winChance: 0.47,
        whatUsuallyHappens:
          "Convert about half the time on 4th and 1. Fail and the other team gets the ball around midfield.",
        plainResult:
          "Keeps the drive alive when it works — biggest upside, but a miss hands them good field position.",
      },
      {
        id: "fg",
        label: "Kick a field goal",
        shortLabel: "Kick",
        winChance: 0.41,
        whatUsuallyHappens:
          "A ~59-yard try is makeable for many kickers but not automatic. Miss and they take over near the 40.",
        plainResult:
          "Ties the game if it goes through. Long kick — miss risk is real.",
      },
      {
        id: "punt",
        label: "Punt",
        shortLabel: "Punt",
        winChance: 0.39,
        whatUsuallyHappens:
          "Pins them deeper, but you give the ball away while still trailing.",
        plainResult:
          "Safer field position, slower path to catching up on the scoreboard.",
      },
    ],
    footnote:
      "Example comparison for product demo. When the offline 4th-down scorer lands, these bars will call that API instead of fixtures.",
  },
  {
    id: "demo-4th-2",
    title: "Goal-to-go late",
    setup:
      "Tied game, two minutes left. Fourth-and-goal from the 2. Do you go for the win, or take the chip-shot kick?",
    apiHook: "POST /models/fourth-down (not on main yet — using example numbers)",
    situation: {
      offense: "BUF",
      defense: "NYJ",
      down: 4,
      distance: 2,
      yardline_100: 2,
      quarter: 4,
      clock: "1:58",
      scoreOffense: 20,
      scoreDefense: 20,
    },
    options: [
      {
        id: "go",
        label: "Go for it",
        shortLabel: "Go",
        winChance: 0.58,
        whatUsuallyHappens:
          "Short-yardage near the goal line converts often — but a stop usually means the other team starts inside their 5.",
        plainResult:
          "Win now if you score. Turnover on downs leaves them backed up but with the ball.",
      },
      {
        id: "fg",
        label: "Kick a field goal",
        shortLabel: "Kick",
        winChance: 0.52,
        whatUsuallyHappens:
          "Nearly automatic from here. You lead by three and kick off — they get one last drive.",
        plainResult:
          "Take the lead, then defend. Less drama on this snap; more on the next drive.",
      },
      {
        id: "punt",
        label: "Punt",
        shortLabel: "Punt",
        winChance: 0.28,
        whatUsuallyHappens:
          "Almost never chosen this close — you walk away from points at the goal line.",
        plainResult:
          "Rarely makes sense here. Shown so you can see why coaches almost always kick or go.",
      },
    ],
    footnote:
      "Example comparison for product demo. Goal-line spots usually drop the punt option in a real decision tool.",
  },
];
