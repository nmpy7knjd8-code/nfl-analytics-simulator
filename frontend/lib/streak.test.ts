import test from "node:test";
import assert from "node:assert/strict";
import { coverMissed, dateKey, emptyStreak, loadStreak, mondayOf, msUntilNextSet, recordDaily, streakCalendar, timeoutAvailable, visibleStreak, type StreakState } from "./daily";

const play = (s: StreakState, date: string) => recordDaily(s, { date, credit: 3, answered: 5 });
const run = (...days: string[]) => days.reduce(play, emptyStreak());

test("missed day with a timeout: streak saved, day marked", () => {
  // Mon 10/19, Tue 10/20, miss Wed 10/21, play Thu 10/22.
  const s = run("2026-10-19", "2026-10-20", "2026-10-22");
  assert.equal(s.current, 3);
  assert.deepEqual(s.shield_days, ["2026-10-21"]);
  assert.equal(timeoutAvailable(s, "2026-10-23"), false);
  assert.equal(timeoutAvailable(s, "2026-10-26"), true, "new week, new timeout");
});

test("missed day without a timeout (already used this week): streak resets", () => {
  const s = run("2026-10-19", "2026-10-21", "2026-10-23"); // miss Tue (saved), miss Thu (no timeout left)
  assert.deepEqual(s.shield_days, ["2026-10-20"]);
  assert.equal(s.current, 1);
});

test("two misses in one week can't both be saved, and timeouts never stack", () => {
  assert.equal(coverMissed([], "2026-10-19", "2026-10-22"), null); // Tue+Wed same week
  // A clean week doesn't bank a second timeout: two misses next week still break it.
  const s = run("2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19", "2026-10-22");
  assert.equal(s.current, 1);
  // Misses in two different weeks (Sun + Mon) are two separate timeouts.
  assert.deepEqual(coverMissed([], "2026-10-24", "2026-10-27"), ["2026-10-25", "2026-10-26"]);
});

test("visible streak stays alive while the missed days are coverable", () => {
  const s = run("2026-10-19", "2026-10-20");
  assert.equal(visibleStreak(s, "2026-10-21"), 2);
  assert.equal(visibleStreak(s, "2026-10-22"), 2, "Wed missed, timeout covers it");
  assert.equal(visibleStreak(s, "2026-10-23"), 0, "Wed + Thu missed");
});

test("NY midnight across both 2026 DST changes", () => {
  // Spring forward: Sun Mar 8 2026, 2:00 EST -> 3:00 EDT. Fall back: Sun Nov 1 2026, 2:00 EDT -> 1:00 EST.
  assert.equal(dateKey(new Date("2026-03-08T04:59:59Z")), "2026-03-07"); // 11:59:59 PM EST
  assert.equal(dateKey(new Date("2026-03-08T05:00:00Z")), "2026-03-08");
  assert.equal(dateKey(new Date("2026-03-09T03:59:59Z")), "2026-03-08"); // 11:59:59 PM EDT
  assert.equal(dateKey(new Date("2026-03-09T04:00:00Z")), "2026-03-09");
  assert.equal(dateKey(new Date("2026-11-02T04:59:59Z")), "2026-11-01"); // 11:59:59 PM EST
  assert.equal(dateKey(new Date("2026-11-02T05:00:00Z")), "2026-11-02");
  // 23-hour and 25-hour days.
  assert.equal(msUntilNextSet(new Date("2026-03-08T05:00:00Z")), 23 * 3_600_000);
  assert.equal(msUntilNextSet(new Date("2026-11-01T04:00:00Z")), 25 * 3_600_000);
  // Streaks across the change dates count calendar days, not hours.
  assert.equal(run("2026-03-07", "2026-03-08", "2026-03-09").current, 3);
  assert.equal(run("2026-10-31", "2026-11-01", "2026-11-02").current, 3);
  assert.equal(mondayOf("2026-11-01"), "2026-10-26");
});

test("calendar: 7 columns, Monday first, states from storage; clearing storage resets", () => {
  const s = run("2026-10-19", "2026-10-20", "2026-10-22");
  const cal = streakCalendar(s, "2026-10-26", 2);
  assert.ok(cal.every((w) => w.length === 7));
  assert.equal(cal[0][0].key, "2026-10-19");
  assert.deepEqual(cal[0].slice(0, 4).map((d) => d.state), ["played", "played", "shield", "played"]);
  assert.equal(cal[0][4].state, "missed");
  assert.equal(cal[1][0].state, "today");
  assert.equal(cal[1][1].state, "future");
  const empty = loadStreak({ getItem: () => null, setItem: () => {} });
  assert.deepEqual(empty, emptyStreak());
  assert.ok(streakCalendar(empty, "2026-10-26", 1)[0].every((d) => d.state !== "played"));
});
