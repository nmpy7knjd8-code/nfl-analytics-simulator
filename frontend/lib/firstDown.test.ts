import test from "node:test";
import assert from "node:assert/strict";
import { FIRST_DOWN_PACK as P, firstDownShare, situationText, spotRates, weekKey, weekNumber, weeklySet } from "./firstDown";

test("pack follows the filters and is built from the data", () => {
  assert.ok(P.plays.length >= P.per_week * 52);
  for (const p of P.plays) {
    assert.ok(p.qtr >= 1 && p.qtr <= 4);
    assert.ok(p.call === "pass" || p.call === "run");
    assert.ok(P.buckets[p.bucket], p.bucket);
  }
  for (const r of Object.values(P.league)) assert.ok(r.on_schedule > 0 && r.on_schedule < 1 && r.plays > 1000);
});

test("week is keyed by the ET Monday", () => {
  assert.equal(weekKey("2026-10-26"), "2026-10-26"); // Monday
  assert.equal(weekKey("2026-11-01"), "2026-10-26"); // Sunday
  assert.equal(weekKey("2026-11-02"), "2026-11-02");
  assert.equal(weekNumber("2026-01-05"), 1);
  assert.deepEqual(weeklySet("2026-10-27").map((p) => p.id), weeklySet("2026-11-01").map((p) => p.id));
  assert.notDeepEqual(weeklySet("2026-10-27").map((p) => p.id), weeklySet("2026-11-02").map((p) => p.id));
  assert.equal(weeklySet("2026-10-27").length, 5);
});

test("rates come from the data, with a league fallback", () => {
  const p = P.plays[0];
  const r = spotRates(p);
  const b = P.buckets[p.bucket];
  if (r.similar) assert.equal(r.pass.on_schedule, b.pass!.on_schedule);
  assert.equal(spotRates(p, P, 1e9).similar, false);
});

test("situation and share text: plain words, no spoilers", () => {
  for (const p of weeklySet("2026-10-26")) {
    assert.match(situationText(p), /1st & 10/);
    assert.doesNotMatch(situationText(p), /EPA|play_id|\b\d{3,}\b/);
  }
  const t = firstDownShare("2026-10-26", [true, false, true, true, false], "https://x.test/");
  assert.equal(t, `Fourth & Daily · First-down call, week ${weekNumber("2026-10-26")} · 3/5\n🟦⬛🟦🟦⬛\nhttps://x.test/`);
  for (const p of weeklySet("2026-10-26")) assert.ok(!t.includes(p.posteam) && !t.includes(p.defteam));
});
