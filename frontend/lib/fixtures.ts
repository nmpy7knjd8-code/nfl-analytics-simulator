/**
 * Demo fixtures so the fan UI runs without a live API / lake.
 * Clearly labeled example data — not live model output.
 */

import { CLOSE_LABEL } from "./labels";
import type { GameSummary } from "../contracts";
import type { GamesResponse, PlaysResponse } from "./api";
import { GAME_FACTS } from "./gameFacts";
import { gamePlays } from "./gamePlays";

/** The one source line on game pages (real nflverse plays and win chance). */
export const GAME_SOURCE_LINE = "Real plays and win chance from nflverse (not our model).";

/** The one source line on game pages (real nflverse plays and win chance). */
export const GAME_SOURCE_LINE = "Real plays and win chance from nflverse (not our model).";

export const FIXTURE_BANNER =
  "Example data — not live. Shows how the product will feel once the API is connected.";

/** Game facts come only from nflverse (lib/gameFacts.json, generated + checked in CI). */
export const FIXTURE_GAMES: GamesResponse = {
  items: GAME_FACTS.map(({ overtime: _ot, ...g }) => ({ ...g, league: "NFL" }) as GameSummary),
  total: GAME_FACTS.length,
  limit: 500,
  offset: 0,
  truth_label: "historical",
};

export function fixtureGame(gameId: string): GameSummary | null {
  return FIXTURE_GAMES.items.find((g) => g.game_id === gameId) ?? null;
}

export function fixturePlays(gameId: string): PlaysResponse | null {
  const game = fixtureGame(gameId);
  if (!game) return null;
  // Real nflverse rows from lib/plays/<game_id>.json (#86); the hand-written rows are gone (QA H7).
  const items = gamePlays(gameId) ?? [];
  return {
    game_id: gameId,
    items,
    total: items.length,
    limit: 2000,
    offset: 0,
    truth_label: "historical",
    reference_disclaimer:
      GAME_SOURCE_LINE,
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
  /** One-line layman reason this choice helps or hurts here. */
  why: string;
};

export type FourthDownScenario = {
  id: string;
  title: string;
  setup: string;
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
  /**
   * Plain-English reason the recommended call (or inconclusive) makes sense.
   * Always shown next to the recommendation — not model metrics.
   */
  whyRecommended: string;
};

/** Within this gap (win-chance points), treat top options as too close to call. */
export const RECOMMENDATION_MARGIN = 0.02;

export type Recommendation =
  | { kind: "pick"; option: FourthDownOption; why: string }
  | { kind: "inconclusive"; leaders: FourthDownOption[]; why: string };

export function getRecommendation(scenario: FourthDownScenario): Recommendation {
  const ranked = [...scenario.options].sort((a, b) => b.winChance - a.winChance);
  const [first, second] = ranked;
  if (!first) {
    return {
      kind: "inconclusive",
      leaders: [],
      why: "Not enough information to recommend a call.",
    };
  }
  if (second && first.winChance - second.winChance < RECOMMENDATION_MARGIN) {
    return {
      kind: "inconclusive",
      leaders: ranked.filter((o) => first.winChance - o.winChance < RECOMMENDATION_MARGIN),
      why: scenario.whyRecommended,
    };
  }
  return { kind: "pick", option: first, why: scenario.whyRecommended };
}

export const FOURTH_DOWN_SCENARIOS: FourthDownScenario[] = [
  {
    id: "demo-4th-1",
    title: "Fourth-and-short near midfield",
    setup:
      "Your team is down by a field goal late in the third. It’s 4th and 1 from the opponent’s 42.",
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
        why: "Short yardage converts often, and you need a score — not just better field position.",
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
        why: "A make ties it, but this is a long try — a miss is almost as costly as failing on fourth down.",
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
        why: "Safer for field position, but you stay behind and give the ball away on purpose.",
      },
    ],
    whyRecommended:
      "You're already behind, and 4th-and-1 is a high-percentage chance to keep the drive alive. A long field goal or a punt both give up the ball without solving the score.",
  },
  {
    id: "demo-4th-2",
    title: "Goal-to-go late",
    setup:
      "Tied game, two minutes left. Fourth-and-goal from the 2. Do you go for the win, or take the chip-shot kick?",
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
        why: "A touchdown wins it now; failing still leaves them with a long field.",
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
        why: "Almost automatic points, but you only lead by three and still have to stop their final drive.",
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
        why: "Walking away from the goal line gives up free points — almost never the better call.",
      },
    ],
    whyRecommended:
      "Tied late from the 2, going for it plays to win on this snap. A field goal only puts you up three and still leaves them a chance to answer.",
  },
  {
    id: "demo-4th-3",
    title: CLOSE_LABEL,
    setup:
      "Colts up three on the Packers with 1:58 left (2020, Week 11). 4th and 4 at the Green Bay 36 — a 54-yard kick, go for it, or punt?",
    // Real play: nflverse 2020_11_GB_IND play_id 3892. Win chances from the offline
    // 4th-down engine (fourth_down_engine.v1); FG distance = yardline_100 + 18 = 54 yd.
    situation: {
      offense: "IND",
      defense: "GB",
      down: 4,
      distance: 4,
      yardline_100: 36,
      quarter: 4,
      clock: "1:58",
      scoreOffense: 31,
      scoreDefense: 28,
    },
    options: [
      {
        id: "fg",
        label: "Kick a field goal",
        shortLabel: "Kick",
        winChance: 0.667,
        whatUsuallyHappens:
          "A 54-yard try is makeable but far from automatic. A make puts you up six; a miss hands them the ball near their own 44.",
        plainResult: "Up six with under two minutes if it's good — they still need only a touchdown.",
        why: "Points now force them to score a touchdown, but a 54-yarder misses often enough to keep this close.",
      },
      {
        id: "go",
        label: "Go for it",
        shortLabel: "Go",
        winChance: 0.657,
        whatUsuallyHappens:
          "4th and 4 converts a bit under half the time. Convert and you can run out much of the clock; fail and they start at their own 36.",
        plainResult: "Convert and you can nearly end it. Fail and they need only a field goal to tie from good position.",
        why: "A first down lets you drain the clock — but a stop gives them a short field while you lead by just three.",
      },
      {
        id: "punt",
        label: "Punt",
        shortLabel: "Punt",
        winChance: 0.623,
        whatUsuallyHappens: "From the 36 a punt nets little — often a touchback to the 20.",
        plainResult: "Safest on this snap, but you gain only about 16 yards of field position.",
        why: "Too close to the end zone for a punt to buy much field position.",
      },
    ],
    whyRecommended:
      "Kicking and going land about one point apart here — either is defensible. (The Colts went for it: Rivers hit Hines for 13 yards and a first down.)",
  },
];
