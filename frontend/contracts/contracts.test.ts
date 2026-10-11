import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CanonicalPlay,
  GameSituation,
  GameSummary,
  SimulationRequest,
} from "./index.ts";

describe("TS contract shapes", () => {
  it("accepts MVP game + situation with derived receive_2h_ko", () => {
    const game: GameSummary = {
      game_id: "2023_01_KC_DET",
      league: "NFL",
      season: 2023,
      week: 1,
      season_type: "REG",
      game_date: "2023-09-07",
      home_team_id: "DET",
      away_team_id: "KC",
      roof: "dome",
    };
    const situation: GameSituation = {
      game_id: game.game_id,
      season: 2023,
      week: 1,
      possession_team_id: "KC",
      defense_team_id: "DET",
      home_team_id: "DET",
      away_team_id: "KC",
      is_home_possession: false,
      down: 3,
      distance: 7,
      yardline_100: 33,
      quarter: 2,
      half_seconds_remaining: 320,
      game_seconds_remaining: 1220,
      score_differential: 3,
      posteam_score: 10,
      defteam_score: 7,
      posteam_timeouts: 2,
      defteam_timeouts: 3,
      receive_2h_ko: 1,
      reference_ep: 2.1,
    };
    const req: SimulationRequest = { situation, seed: 42 };
    assert.equal(req.seed, 42);
    assert.equal(situation.receive_2h_ko, 1);
  });

  it("namespaces reference ep/epa/wp on plays", () => {
    const play: CanonicalPlay = {
      play_id: "p1",
      game_id: "g1",
      play_index: 0,
      quarter: 1,
      play_type: "pass",
      reference: { ep: 1.2, epa: 0.1, wp: 0.55 },
    };
    assert.equal(play.reference?.ep, 1.2);
  });
});
