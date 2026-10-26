import { test } from "node:test";
import assert from "node:assert/strict";
import { clockLabel, findSwingPlays, isSwing, DEFAULT_SWING_WP_THRESHOLD } from "./winProbability";
import { fixturePlays, fixtureGame } from "./fixtures";
import { WP_FIXTURES } from "./wpFixtures";

test("fixtures follow the contract: home, pre-snap, post = next pre, final = result", () => {
  for (const { series, origin } of Object.values(WP_FIXTURES)) {
    assert.equal(origin, "example");
    const pts = series.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      assert.ok(p.home_wp_pre >= 0 && p.home_wp_pre <= 1 && p.home_wp_post >= 0 && p.home_wp_post <= 1);
      assert.ok(Math.abs(p.delta_home_wp - (p.home_wp_post - p.home_wp_pre)) < 1e-9);
      if (i + 1 < pts.length) assert.equal(p.home_wp_post, pts[i + 1].home_wp_pre);
      if (i > 0) assert.ok(p.game_seconds_elapsed >= pts[i - 1].game_seconds_elapsed, "x-axis never rewinds");
    }
    const final = pts.at(-1)!.home_wp_post;
    assert.equal(final, series.result === "home_win" ? 1 : series.result === "away_win" ? 0 : 0.5);
    assert.deepEqual(series.swing_play_ids, pts.filter((p) => p.is_swing).map((p) => p.play_id));
    assert.equal(series.has_overtime, pts.some((p) => p.is_overtime));
  }
});

test("DET–KC: Detroit (away) won 21–20 everywhere", () => {
  const g = fixtureGame("2023_01_DET_KC")!;
  assert.equal(g.away_team_id, "DET");
  assert.equal(g.away_score, 21);
  assert.equal(g.home_score, 20);
  const wp = WP_FIXTURES["2023_01_DET_KC"].series;
  assert.equal(wp.result, "away_win");
  assert.equal(wp.points.at(-1)!.home_wp_post, 0);
  const plays = fixturePlays("2023_01_DET_KC")!.items;
  for (const p of plays) {
    const r = p.reference;
    if (r?.wp == null || r.home_wp == null) continue;
    const expectHome = p.possession_team_id === g.home_team_id ? r.wp : 1 - r.wp;
    assert.ok(Math.abs(expectHome - r.home_wp) < 1e-9, `play ${p.play_id}`);
  }
  assert.equal(plays.at(-1)!.reference?.home_wp, 0);
});

test("backend is_swing flags win; threshold is only the fallback", () => {
  assert.equal(DEFAULT_SWING_WP_THRESHOLD, 0.08);
  assert.equal(isSwing({ delta_home_wp: 0.3, is_swing: false }), false);
  assert.equal(isSwing({ delta_home_wp: 0.01, is_swing: true }), true);
  assert.equal(isSwing({ delta_home_wp: 0.08 }), true);
  assert.equal(isSwing({ delta_home_wp: -0.079 }), false);
  const s = structuredClone(WP_FIXTURES["2023_01_DET_KC"].series);
  for (const p of s.points) p.is_swing = p.play_id === "4";
  const sw = findSwingPlays(s);
  assert.deepEqual(sw.map((x) => x.point.play_id), ["4"]);
});

test("swing plays are biggest first, at most 3, with a Why", () => {
  const sw = findSwingPlays(WP_FIXTURES["2023_01_DET_KC"].series);
  assert.equal(sw.length, 3);
  for (let i = 1; i < sw.length; i++) assert.ok(Math.abs(sw[i - 1].delta) >= Math.abs(sw[i].delta));
  const pick6 = sw.find((s) => /Interception/.test(s.point.description ?? ""));
  assert.ok(pick6 && pick6.favored_team_id === "DET");
  assert.match(pick6.why, /turnover/);
});

test("BUF@NYJ: Week 1, 2023-09-11, NYJ (home) wins 22–16 in OT", () => {
  const g = fixtureGame("2023_01_BUF_NYJ")!;
  assert.equal(g.week, 1);
  assert.equal(g.game_date, "2023-09-11");
  assert.equal(g.home_team_id, "NYJ");
  assert.equal(g.home_score, 22);
  assert.equal(g.away_score, 16);
  assert.equal(fixtureGame("2023_02_BUF_NYJ"), null);
  const s = WP_FIXTURES["2023_01_BUF_NYJ"].series;
  assert.equal(s.home_team_id, "NYJ");
  assert.equal(s.result, "home_win");
  assert.equal(s.has_overtime, true);
  assert.ok(s.points.some((p) => p.is_overtime && p.game_seconds_elapsed > 3600));
  assert.equal(s.points.at(-1)!.home_wp_post, 1);
});

test("clock labels from game_seconds_elapsed, including OT", () => {
  assert.equal(clockLabel({ quarter: 3, is_overtime: false, game_seconds_elapsed: 2075 }), "Q3 10:25");
  assert.equal(clockLabel({ quarter: 5, is_overtime: true, game_seconds_elapsed: 3748 }), "OT 7:32");
  const ot = WP_FIXTURES["2023_01_BUF_NYJ"].series.points.find((p) => p.is_overtime)!;
  assert.equal(clockLabel(ot), "OT 7:32");
});
