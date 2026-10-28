import { test } from "node:test";
import assert from "node:assert/strict";
import { allGames, allPairs, pairKey, rivalry, seriesLine } from "./rivalries";

test("every game lands in exactly one pair and pair counts add up", () => {
  const n = allPairs().reduce((s, k) => s + rivalry(k)!.meetings.length, 0);
  assert.equal(n, allGames().length);
  assert.equal(allGames().length, 1960);
});

test("OAK is grouped with LV; keys are alphabetical", () => {
  assert.equal(pairKey("OAK", "KC"), "KC-LV");
  assert.equal(pairKey("KC", "BUF"), "BUF-KC");
  assert.ok(!allPairs().some((k) => k.includes("OAK")));
});

test("records and points match the meetings", () => {
  for (const k of allPairs()) {
    const r = rivalry(k)!;
    assert.equal(r.aWins + r.bWins + r.ties, r.meetings.length, k);
    const pts = (t: string) => r.meetings.reduce((s, m) => s + (m.home === t ? m.home_score : m.away_score), 0);
    assert.equal(r.aPts, pts(r.a)); assert.equal(r.bPts, pts(r.b));
    for (let i = 1; i < r.meetings.length; i++) assert.ok(r.meetings[i - 1].date <= r.meetings[i].date);
  }
});

test("BUF-KC includes the playoff meetings with round names", () => {
  const r = rivalry("BUF-KC")!;
  assert.ok(r.meetings.some((m) => m.round === "Divisional"));
  assert.match(seriesLine(r, (t) => t), /^(BUF|KC) lead \d+–\d+$|^Series tied/);
  assert.equal(rivalry("BUF-XXX"), null);
});

import { stripColors, usable } from "./rivalries";
test("strip colors: team colors, readable on white, distinct", () => {
  assert.deepEqual(stripColors("BUF", "KC"), ["#00338D", "#E31837"]);
  const [, lv] = stripColors("KC", "LV");
  assert.notEqual(lv, "#000000");
  assert.ok(usable(lv));
  for (const k of allPairs()) { const [x, y] = stripColors(...(k.split("-") as [string, string])); assert.notEqual(x, y, k); }
});

import { teamRivals } from "./rivalries";
test("teamRivals: records add up and match the pair pages", () => {
  const kc = teamRivals("KC");
  assert.equal(kc.reduce((s, r) => s + r.meetings, 0), allGames().filter((g) => g.home === "KC" || g.away === "KC").length);
  for (const r of kc) assert.equal(r.w + r.l + r.t, r.meetings);
  const lv = kc.find((r) => r.opp === "LV")!;
  assert.deepEqual([lv.key, lv.meetings, lv.w, lv.l], ["KC-LV", 14, 11, 3]);
  assert.ok(kc[0].meetings >= kc[kc.length - 1].meetings);
});
