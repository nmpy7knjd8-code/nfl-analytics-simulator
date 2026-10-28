import { test } from "node:test";
import assert from "node:assert/strict";
import { shieldStreak, weekStart, calendarCells } from "./shields";

test("weeks start Monday", () => {
  assert.equal(weekStart("2026-10-28"), "2026-10-26");
  assert.equal(weekStart("2026-11-01"), "2026-10-26");
});
test("no days played", () => assert.equal(shieldStreak([], "2026-10-28").streak, 0));
test("today not played yet keeps the streak", () => {
  assert.equal(shieldStreak(["2026-10-26", "2026-10-27"], "2026-10-28").streak, 2);
});
test("one missed day is shielded", () => {
  const s = shieldStreak(["2026-10-26", "2026-10-28"], "2026-10-28");
  assert.equal(s.streak, 2);
  assert.equal(s.marks.get("2026-10-27"), "shield");
  assert.equal(s.shieldUsedThisWeek, true);
});
test("a missed day with the shield already used ends the streak", () => {
  const s = shieldStreak(["2026-10-26", "2026-10-28", "2026-10-30"], "2026-10-30");
  assert.equal(s.marks.get("2026-10-27"), "shield");
  assert.equal(s.marks.get("2026-10-29"), "missed");
  assert.equal(s.streak, 1);
});
test("two misses in a row in one week: second one breaks", () => {
  const s = shieldStreak(["2026-10-26", "2026-10-29"], "2026-10-29");
  assert.equal(s.marks.get("2026-10-27"), "shield");
  assert.equal(s.marks.get("2026-10-28"), "missed");
  assert.equal(s.streak, 1);
});
test("each new week gets a fresh shield", () => {
  const s = shieldStreak(["2026-10-30", "2026-11-01", "2026-11-03"], "2026-11-03");
  assert.equal(s.marks.get("2026-10-31"), "shield");
  assert.equal(s.marks.get("2026-11-02"), "shield");
  assert.equal(s.streak, 3);
});
test("DST start (Mar 8 2026) does not skip or repeat a day", () => {
  const s = shieldStreak(["2026-03-07", "2026-03-08", "2026-03-09"], "2026-03-09");
  assert.equal(s.streak, 3);
  assert.equal([...s.marks.values()].filter((m) => m !== "played").length, 0);
});
test("DST end (Nov 1 2026) does not skip or repeat a day", () => {
  const s = shieldStreak(["2026-10-31", "2026-11-01", "2026-11-02"], "2026-11-02");
  assert.equal(s.streak, 3);
  assert.equal(s.marks.size, 3);
});
test("calendar: 35 cells, Monday first, today is open", () => {
  const st = shieldStreak(["2026-10-26", "2026-10-28"], "2026-10-28");
  const c = calendarCells(st, "2026-10-28");
  assert.equal(c.length, 35);
  assert.equal(c[0].date, "2026-09-28");
  assert.equal(c.find((x) => x.date === "2026-10-27")!.mark, "shield");
  assert.equal(c.find((x) => x.date === "2026-10-25")!.mark, "before");
});

test("#179 fix: shield square has no stray sentence styles; calendar is a list", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  const css = read("../app/simple-game.css");
  assert.doesNotMatch(css, /(^|[\s}])\.st-shield\s*\{/m, "bare .st-shield rule would also hit the calendar square");
  assert.match(css, /\.st-shield-line\{/);
  const tsx = read("../components/StatsView.tsx");
  assert.match(tsx, /className="st-shield-line"/);
  assert.match(tsx, /role="list" aria-label="Last five weeks"/);
  assert.doesNotMatch(tsx, /role="(grid|gridcell)"/);
});
