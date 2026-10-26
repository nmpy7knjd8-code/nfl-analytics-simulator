import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailySet, emptyStreak, loadStreak, recordDaily, saveStreak, visibleStreak, withYou,
} from "./dailyQuiz";
import { fixtureLeaderboard } from "./leaderboardFixtures";

test("daily set is deterministic per date and has no repeats", () => {
  const a = dailySet("2026-10-26").map((i) => i.id);
  assert.deepEqual(a, dailySet("2026-10-26").map((i) => i.id));
  assert.equal(new Set(a).size, a.length);
  assert.equal(a.length, 3);
  const days = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-11-01"].map((d) => dailySet(d).map((i) => i.id).join());
  assert.ok(days.some((d) => d !== a.join()), "sets should vary across dates");
});

test("streak grows on consecutive days, resets after a gap, ignores replays", () => {
  let s = recordDaily(emptyStreak(), { date: "2026-10-26", credit: 2, answered: 3 });
  s = recordDaily(s, { date: "2026-10-26", credit: 3, answered: 3 });
  assert.equal(s.current, 1);
  s = recordDaily(s, { date: "2026-10-27", credit: 1, answered: 3 });
  assert.equal(s.current, 2);
  assert.equal(visibleStreak(s, "2026-10-28"), 2);
  assert.equal(visibleStreak(s, "2026-10-29"), 0);
  s = recordDaily(s, { date: "2026-10-30", credit: 1, answered: 3 });
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
  // month boundary
  const m = recordDaily(recordDaily(emptyStreak(), { date: "2026-10-31", credit: 1, answered: 3 }), { date: "2026-11-01", credit: 1, answered: 3 });
  assert.equal(m.current, 2);
});

test("streak round-trips through storage and survives junk", () => {
  const mem = new Map<string, string>();
  const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  const s = recordDaily(emptyStreak(), { date: "2026-10-26", credit: 2, answered: 3 });
  saveStreak(store, s);
  assert.deepEqual(loadStreak(store), s);
  mem.set("nfl-sim.daily-quiz.streak.v1", "{not json");
  assert.deepEqual(loadStreak(store), emptyStreak());
  assert.deepEqual(loadStreak(undefined), emptyStreak());
});

test("leaderboard fixture is labeled example and ranks you in", () => {
  const b = fixtureLeaderboard("2026-10-26");
  assert.equal(b.source, "example");
  const r = withYou(b, { points: 2.5, current_streak: 9 });
  const you = r.entries.find((e) => e.is_you)!;
  assert.equal(you.rank, 2);
  assert.deepEqual(r.entries.map((e) => e.rank), [1, 2, 3, 4, 5, 6]);
});
