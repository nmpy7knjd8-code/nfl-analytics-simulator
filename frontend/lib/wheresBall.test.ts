import { test } from "node:test";
import assert from "node:assert/strict";
import retired from "./retiredDailyIds.json";
import { eligibleRounds, roundsFor, roundScore, clampSpot } from "./wheresBall";

test("pool skips retired and overtime plays", () => {
  const pool = eligibleRounds();
  assert.ok(pool.length >= 5);
  assert.ok(pool.every((r) => r.qtr <= 4));
  const ids = new Set(retired as string[]);
  assert.ok(pool.every((r) => !ids.has(r.id)));
});
test("five distinct rounds, stable per day", () => {
  const a = roundsFor("2026-10-28");
  assert.equal(new Set(a.map((r) => r.id)).size, 5);
  assert.deepEqual(roundsFor("2026-10-28"), a);
});
test("scoring", () => {
  assert.equal(roundScore(30, 30), 100);
  assert.equal(roundScore(40, 30), 80);
  assert.equal(roundScore(99, 1), 0);
  assert.equal(clampSpot(0), 1);
  assert.equal(clampSpot(120), 99);
});
