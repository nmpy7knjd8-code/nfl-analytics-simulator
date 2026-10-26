import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
  CanonicalPlay,
  GameSituation,
  GameSummary,
  SimulationRequest,
  WinProbabilitySeries,
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

describe("Win-probability contract", () => {
  it("is home-perspective, pre-snap, and swing ids match flags", async () => {
    const { readFileSync } = await import("node:fs");
    const series: WinProbabilitySeries = {
      game_id: "2023_01_DET_KC",
      home_team_id: "KC",
      away_team_id: "DET",
      home_score: 20,
      away_score: 21,
      result: "away_win",
      perspective: "home",
      timing: "pre_snap",
      swing_threshold: 0.08,
      source: "nflverse_reference_home_wp",
      truth_label: "historical",
      has_overtime: false,
      points: [
        { play_id: "4204", play_index: 1027, quarter: 4, is_overtime: false,
          game_seconds_elapsed: 3563, possession_team_id: "DET",
          home_wp_pre: 0.082, home_wp_post: 0, delta_home_wp: -0.082, is_swing: true,
          // 0:37 left in Q4 → low clock before half: kept on the chart, down-weighted in Game Story
          is_end_of_half: false, is_low_clock_before_half: true,
          wp_quirk_reason: "low_clock_before_half", story_weight: 0.5 },
      ],
      swing_play_ids: ["4204"],
      story_swing_play_ids: ["4204"],
    };
    assert.equal(series.points.at(-1)!.home_wp_post, 0); // KC (home) lost
    assert.deepEqual(series.swing_play_ids, series.points.filter((p) => p.is_swing).map((p) => p.play_id));
    const schema = JSON.parse(
      readFileSync("contracts/schema/WinProbabilitySeries.schema.json", "utf8"),
    );
    const tsKeys = Object.keys(series).sort();
    assert.deepEqual(Object.keys(schema.properties).sort(), tsKeys);
    const pointKeys = Object.keys(schema.$defs.WinProbabilityPoint.properties).sort();
    assert.deepEqual(pointKeys, [...Object.keys(series.points[0]), "description"].sort());
  });
});
