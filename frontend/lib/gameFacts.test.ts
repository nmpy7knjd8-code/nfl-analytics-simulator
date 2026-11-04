import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_FACTS_BY_ID } from "./gameFacts";
import { FIXTURE_GAMES, fixturePlays } from "./fixtures";
import { GAME_PLAY_LISTS } from "./gamePlays";
import { WP_FIXTURES } from "./wpFixtures";

test("every fixture game matches nflverse facts", () => {
  for (const g of FIXTURE_GAMES.items) {
    const f = GAME_FACTS_BY_ID[g.game_id];
    assert.ok(f, `${g.game_id} not in gameFacts.json`);
    for (const k of ["week", "game_date", "home_team_id", "away_team_id", "home_score", "away_score"] as const)
      assert.equal(g[k], f[k], `${g.game_id} ${k}`);
  }
});

test("win-chance fixtures use real game ids and end on the real winner (home view)", () => {
  for (const [id, { series: s, overtimePlays }] of Object.entries(WP_FIXTURES)) {
    const f = GAME_FACTS_BY_ID[id];
    assert.ok(f, `${id} not in gameFacts.json`);
    assert.equal(s.home_team_id, f.home_team_id);
    assert.equal(s.away_team_id, f.away_team_id);
    const last = s.points[s.points.length - 1];
    // OT games: the line stops at the end of regulation (house rule), so no final 0/1.
    if (!f.overtime) assert.equal(last.home_wp_post, f.home_score > f.away_score ? 1 : 0, `${id} final home_wp`);
    assert.equal(s.has_overtime, f.overtime, `${id} overtime`);
    assert.equal(overtimePlays.length > 0, f.overtime, `${id} overtime plays kept`);
  }
});

test("the plays file ends on the real final score", () => {
  for (const g of FIXTURE_GAMES.items) {
    assert.ok(fixturePlays(g.game_id)!.items.length > 0);
    const last = GAME_PLAY_LISTS[g.game_id].plays.at(-1)!;
    assert.equal(last.away_score_after, g.away_score);
    assert.equal(last.home_score_after, g.home_score);
  }
});
