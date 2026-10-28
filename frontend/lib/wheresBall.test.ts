import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import retired from "./retiredDailyIds.json";
import { dailySet } from "./daily";
import { eligibleRounds, roundsFor, roundScore, clampSpot } from "./wheresBall";

test("pool skips retired and overtime plays", () => {
  const pool = eligibleRounds();
  assert.ok(pool.length >= 5);
  assert.ok(pool.every((r) => r.qtr <= 4));
  const ids = new Set(retired as string[]);
  assert.ok(pool.every((r) => !ids.has(r.playKey)));
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

test("gorates.json matches data/site exactly", () => {
  const a = readFileSync(new URL("./site/gorates.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/gorates.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("never overlaps that date's 5 daily plays, every day for a year", () => {
  const start = Date.UTC(2026, 9, 26);
  for (let d = 0; d < 366; d++) {
    const day = new Date(start + d * 86400000).toISOString().slice(0, 10);
    const daily = dailySet(day);
    assert.equal(daily.length, 5);
    const dailyKeys = new Set(daily.flatMap((it) => [it.id, `${it.source.game_id}-${it.source.play_id}`]));
    const rounds = roundsFor(day);
    assert.equal(rounds.length, 5, day);
    for (const r of rounds) assert.ok(!dailyKeys.has(r.id) && !dailyKeys.has(r.playKey), `${day} repeats ${r.playKey}`);
  }
});
