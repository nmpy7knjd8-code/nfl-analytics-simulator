import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dailySet, dailyStats, dateKey, emptyStreak, getOrCreateHandle, loadStreak, msUntilNextSet,
  recordDaily, saveStreak, shareText, visibleStreak, HANDLE_STORAGE_KEY,
} from "./dailyQuiz";
import { leaderboardUrl, rankWithYou, fetchLeaderboard } from "./leaderboardApi";
import { EXAMPLE_CROWD_PICKS } from "./leaderboardFixtures";
import { QUIZ_ITEMS } from "./quiz";

const memStore = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test("daily set is deterministic per date and has no repeats", () => {
  const a = dailySet("2026-10-26").map((i) => i.id);
  assert.deepEqual(a, dailySet("2026-10-26").map((i) => i.id));
  assert.equal(new Set(a).size, 3);
  const days = ["2026-10-27", "2026-10-28", "2026-10-29", "2026-11-01"].map((d) => dailySet(d).map((i) => i.id).join());
  assert.ok(days.some((d) => d !== a.join()));
});

test("quiz day rolls over at midnight New York, not local or UTC", () => {
  // 03:59 UTC Oct 27 = 23:59 EDT Oct 26
  assert.equal(dateKey(new Date("2026-10-27T03:59:00Z")), "2026-10-26");
  assert.equal(dateKey(new Date("2026-10-27T04:00:00Z")), "2026-10-27");
  // Winter (EST, UTC-5)
  assert.equal(dateKey(new Date("2026-12-01T04:59:00Z")), "2026-11-30");
  assert.equal(dateKey(new Date("2026-12-01T05:00:00Z")), "2026-12-01");
  // Countdown
  assert.equal(msUntilNextSet(new Date("2026-10-27T03:00:00Z")), 3_600_000);
  // DST end day (Nov 1 2026 is 25h long in New York)
  const ms = msUntilNextSet(new Date("2026-11-01T04:00:00Z"));
  assert.equal(ms, 25 * 3_600_000);
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
  const m = recordDaily(recordDaily(emptyStreak(), { date: "2026-10-31", credit: 1, answered: 3 }), { date: "2026-11-01", credit: 1, answered: 3 });
  assert.equal(m.current, 2);
});

test("stats panel counts days and right-call distribution", () => {
  let s = recordDaily(emptyStreak(), { date: "2026-10-25", credit: 3, answered: 3, results: ["correct", "correct", "correct"] });
  s = recordDaily(s, { date: "2026-10-26", credit: 1.5, answered: 3, results: ["correct", "near_tie", "incorrect"] });
  const st = dailyStats(s, "2026-10-26");
  assert.equal(st.days_played, 2);
  assert.equal(st.current_streak, 2);
  assert.deepEqual(st.right_call_distribution, [0, 1, 0, 1]);
});

test("share text is spoiler-free with date and link", () => {
  const t = shareText("2026-10-26", ["correct", "incorrect", "near_tie"], "https://x.test/quiz");
  assert.equal(t, "4th Down Daily 2026-10-26 — 1/3\n🟦⬜½\nhttps://x.test/quiz");
  for (const it of QUIZ_ITEMS) assert.ok(!t.includes(it.situation.posteam));
});

test("streak round-trips through storage and survives junk", () => {
  const st = memStore();
  const s = recordDaily(emptyStreak(), { date: "2026-10-26", credit: 2, answered: 3 });
  saveStreak(st, s);
  assert.deepEqual(loadStreak(st), s);
  st.m.set("nfl-sim.daily-quiz.streak.v1", "{not json");
  assert.deepEqual(loadStreak(st), emptyStreak());
  assert.deepEqual(loadStreak(undefined), emptyStreak());
});

test("anonymous handle is created once and reused", () => {
  const st = memStore();
  const h = getOrCreateHandle(st, () => 0.5);
  assert.match(h, /^[A-Za-z]+-\d{4}$/);
  assert.equal(st.m.get(HANDLE_STORAGE_KEY), h);
  assert.equal(getOrCreateHandle(st, () => 0.1), h);
  st.m.set(HANDLE_STORAGE_KEY, "<script>");
  assert.notEqual(getOrCreateHandle(st, () => 0.1), "<script>");
});

test("leaderboard stub matches proposed GET /quiz/leaderboard shape and ranks you in", async () => {
  assert.equal(leaderboardUrl("2026-10-26"), "/quiz/leaderboard?date=2026-10-26");
  const b = await fetchLeaderboard("2026-10-26");
  assert.equal(b.source, "example");
  for (const r of b.rows) assert.deepEqual(Object.keys(r).sort(), ["handle", "score", "streak"]);
  const r = rankWithYou(b.rows, { handle: "Pylon-0001", score: 2.5, streak: 9 });
  assert.equal(r.find((x) => x.is_you)!.rank, 2);
  assert.deepEqual(r.map((x) => x.rank), [1, 2, 3, 4, 5, 6]);
});

test("example crowd picks cover the pack and sum to 1", () => {
  for (const it of QUIZ_ITEMS) {
    const c = EXAMPLE_CROWD_PICKS[it.id];
    assert.ok(c, it.id);
    assert.ok(Math.abs(c.go + c.fg + c.punt - 1) < 1e-9);
  }
});
