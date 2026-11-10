import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyStreak, recordDaily } from "./daily";
import { clockCountdown, playedToday, streakLine } from "./emptyState";

test("played-today state only for today's finished set", () => {
  const s = recordDaily(emptyStreak(), { date: "2026-10-28", credit: 3.5, answered: 5 });
  assert.deepEqual(playedToday(s, "2026-10-28"), { score: "3.5", answered: 5 });
  assert.equal(playedToday(s, "2026-10-29"), null);
  assert.equal(playedToday(emptyStreak(), "2026-10-28"), null);
});

test("countdown and streak copy", () => {
  assert.equal(clockCountdown(((7 * 60 + 42) * 60 + 5) * 1000 + 300), "07:42:05");
  assert.equal(clockCountdown(-5), "00:00:00");
  assert.equal(streakLine(0), "New streak starts today.");
  assert.equal(streakLine(4), "4-day streak");
});
