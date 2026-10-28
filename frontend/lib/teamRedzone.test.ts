import test from "node:test";
import assert from "node:assert/strict";
import { REDZONE, seasonKeys, sliceFor, vsLeague, ALL } from "./teamRedzone";

test("real data only: no stub, 32 teams, counts add up", () => {
  assert.equal(REDZONE.stub, false);
  assert.equal(REDZONE.teams.length, 32);
  for (const t of REDZONE.teams) assert.equal(t.td + t.fg + t.no_score, t.drives, t.team);
  assert.equal(REDZONE.teams.reduce((a, t) => a + t.drives, 0), REDZONE.league.drives);
});

test("every per-season slice (when present) has the same invariants", () => {
  for (const k of seasonKeys()) {
    const s = sliceFor(k);
    for (const t of s.teams) assert.equal(t.td + t.fg + t.no_score, t.drives, `${k} ${t.team}`);
    assert.equal(s.teams.reduce((a, t) => a + t.drives, 0), s.league.drives, k);
  }
  assert.equal(sliceFor(ALL), REDZONE);
});

test("league comparison wording", () => {
  assert.equal(vsLeague(0.62, 0.57), "5 percentage points above the league");
  assert.equal(vsLeague(0.56, 0.57), "1 percentage point below the league");
  assert.equal(vsLeague(0.571, 0.57), "Same as the league");
});
