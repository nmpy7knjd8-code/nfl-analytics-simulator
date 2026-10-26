import { test } from "node:test";
import assert from "node:assert/strict";
import { clockLabel, findSwingPlays, seriesFromPlays } from "./winProbability";
import { fixturePlays, fixtureGame } from "./fixtures";
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

test("DET–KC example plays: final WP matches winner and wp/home_wp agree", () => {
  const g = fixtureGame("2023_01_DET_KC")!;
  const plays = fixturePlays("2023_01_DET_KC")!.items;
  const winner = (g.home_score ?? 0) > (g.away_score ?? 0) ? g.home_team_id : g.away_team_id;
  for (const p of plays) {
    const r = p.reference;
    if (r?.wp == null || r.home_wp == null) continue;
    const expectHome = p.possession_team_id === g.home_team_id ? r.wp : 1 - r.wp;
    assert.ok(Math.abs(expectHome - r.home_wp) < 1e-9, `play ${p.play_id}`);
  }
  const s = seriesFromPlays(g.game_id, g.home_team_id, g.away_team_id, plays);
  assert.equal(s.points.at(-1)!.home_wp, winner === g.home_team_id ? 1 : 0);
});

test("clock labels show quarter clock and OT clock", () => {
  const base = { play_id: "x", play_index: 1, home_wp: 0.5 };
  assert.equal(clockLabel({ ...base, quarter: 3, game_seconds_remaining: 1525 }), "Q3 10:25");
  assert.equal(clockLabel({ ...base, quarter: 5, game_seconds_remaining: 0, ot_seconds_remaining: 452 }), "OT 7:32");
  const ot = findSwingPlays(WP_FIXTURES["2023_02_BUF_NYJ"]).find((x) => x.point.quarter === 5);
  assert.ok(ot && clockLabel(ot.point) === "OT 7:32");
});
