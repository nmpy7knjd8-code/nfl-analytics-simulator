import { test } from "node:test";
import assert from "node:assert/strict";
import { CLOSE_LINE, GT, gtView, teamStats, yardsVsLeague, type GtView } from "./teamGarbageTime";
import { REDZONE } from "./teamRedzone";

const sum = (v: GtView, k: "rz" | "ypp" | "third", i: 0 | 1) => v.teams.reduce((a, t) => a + t[k][i], 0);

test("real data, 7 seasons, 32 teams per view", () => {
  assert.equal(GT.stub, false);
  assert.deepEqual(GT.season_list, [2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  for (const s of ["all", ...GT.season_list.map(String)]) for (const v of ["all", "close"] as const) {
    assert.equal(gtView(v, s)!.teams.length, 32, `${s}/${v}`);
  }
});

test("league totals equal team sums in every view and season; close is a subset of all", () => {
  for (const s of ["all", ...GT.season_list.map(String)]) {
    for (const v of ["all", "close"] as const) {
      const V = gtView(v, s)!;
      for (const k of ["rz", "ypp", "third"] as const) {
        assert.equal(V.league[k][0], sum(V, k, 0), `${s}/${v}/${k}`);
        assert.equal(V.league[k][1], sum(V, k, 1), `${s}/${v}/${k}`);
      }
    }
    const A = gtView("all", s)!, C = gtView("close", s)!;
    for (const t of A.teams) {
      const c = C.teams.find((x) => x.team === t.team)!;
      assert.ok(c.rz[0] <= t.rz[0] && c.ypp[0] <= t.ypp[0] && c.third[0] <= t.third[0], `${s} ${t.team}`);
    }
  }
});

test("all-plays red zone matches teamRedzone.json; headline totals", () => {
  for (const t of GT.all.teams) {
    const r = REDZONE.teams.find((x) => x.team === t.team)!;
    assert.deepEqual([t.rz[0], t.rz[1]], [r.drives, r.td]);
  }
  const k = (v: "all" | "close") => teamStats("KC", gtView(v, "all")!)!;
  assert.equal(GT.all.league.rz[0], 12782);
  assert.equal((k("all").rz.league * 100).toFixed(1), "57.0");
  assert.equal((k("close").rz.league * 100).toFixed(1), "57.1");
  assert.equal(k("all").ypp.league.toFixed(2), "5.49");
  assert.equal(k("close").ypp.league.toFixed(2), "5.55");
  assert.equal((k("all").third.league * 100).toFixed(1), "40.1");
  assert.equal((k("close").third.league * 100).toFixed(1), "40.8");
});

test("wording stays plain", () => {
  assert.doesNotMatch(CLOSE_LINE, /garbage|win prob|chance|EPA|WPA|odds|bet|vegas/i);
  assert.equal(yardsVsLeague(5.8, 5.49), "0.3 yards more than the league");
  assert.equal(yardsVsLeague(5.38, 5.49), "0.1 yards fewer than the league");
  assert.equal(yardsVsLeague(5.5, 5.49), "Same as the league");
});
