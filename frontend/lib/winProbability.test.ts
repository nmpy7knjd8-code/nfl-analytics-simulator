import { test } from "node:test";
import assert from "node:assert/strict";
import { findSwingPlays, seriesFromPlays } from "./winProbability";
import { WP_FIXTURES } from "./wpFixtures";

test("fixtures stay in [0,1] and are labeled example", () => {
  for (const s of Object.values(WP_FIXTURES)) {
    assert.equal(s.source, "example");
    for (const p of s.points) assert.ok(p.home_wp >= 0 && p.home_wp <= 1);
  }
});

test("swing plays are biggest moves first, with a Why", () => {
  const sw = findSwingPlays(WP_FIXTURES["2023_01_DET_KC"]);
  assert.equal(sw.length, 3);
  assert.ok(Math.abs(sw[0].delta) >= Math.abs(sw[1].delta));
  const pick6 = sw.find((s) => s.favored_team_id === "DET");
  assert.ok(pick6, "pick-six should be a swing play");
  assert.match(pick6.why, /turnover/);
});

test("seriesFromPlays converts possession wp to home wp and skips missing", () => {
  const s = seriesFromPlays("g", "KC", "DET", [
    { play_id: "1", game_id: "g", play_index: 1, quarter: 1, half_seconds_remaining: 1800, possession_team_id: "DET", play_type: "pass", reference: { wp: 0.4 } },
    { play_id: "2", game_id: "g", play_index: 2, quarter: 3, half_seconds_remaining: 900, possession_team_id: "KC", play_type: "rush" },
    { play_id: "3", game_id: "g", play_index: 3, quarter: 3, game_seconds_remaining: 800, possession_team_id: "KC", play_type: "rush", reference: { home_wp: 0.7 } },
  ]);
  assert.equal(s.points.length, 2);
  assert.ok(Math.abs(s.points[0].home_wp - 0.6) < 1e-9);
  assert.equal(s.points[0].game_seconds_remaining, 3600);
  assert.equal(s.points[1].home_wp, 0.7);
});
