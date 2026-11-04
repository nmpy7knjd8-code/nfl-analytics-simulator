import { test } from "node:test";
import assert from "node:assert/strict";
import { quarterClockFromGame, quarterClockFromHalf } from "./clock";
import { FIXTURE_GAMES, fixturePlays } from "./fixtures";
import { QUIZ_ITEMS } from "./quiz";

test("kickoff shows Q1 15:00, not 30:00 or 60:00", () => {
  assert.equal(quarterClockFromHalf(1, 1800), "15:00");
  assert.equal(quarterClockFromGame(1, 3600), "15:00");
  assert.equal(quarterClockFromHalf(2, 120), "2:00");
  assert.equal(quarterClockFromHalf(3, 1752), "14:12");
  assert.equal(quarterClockFromGame(4, 45), "0:45");
  assert.equal(quarterClockFromGame(3, 1500), "10:00");
});

test("every fixture and quiz clock is within 0:00–15:00", () => {
  const ok = (c: string) => {
    const [m, s] = c.split(":").map(Number);
    return m * 60 + s <= 900;
  };
  for (const g of FIXTURE_GAMES.items)
    for (const p of fixturePlays(g.game_id)?.items ?? [])
      if (p.half_seconds_remaining != null) assert.ok(ok(quarterClockFromHalf(p.quarter, p.half_seconds_remaining)));
  for (const q of QUIZ_ITEMS) assert.ok(ok(quarterClockFromGame(q.situation.qtr, q.situation.game_seconds_remaining)));
});
