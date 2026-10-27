import { test } from "node:test";
import assert from "node:assert/strict";
import schedule from "./dailySchedule.json";
import retiredIds from "./retiredDailyIds.json";
import { DAILY_ITEMS, DAILY_SET_SIZE, cycleDays, dailySet, dateKey } from "./daily";

const DAYS = (schedule as { days: Record<string, string[]> }).days;
const LAUNCH = "2026-10-26"; // #53 shipped 23:39 ET Oct 26
const RETIRED = new Set(retiredIds as string[]);
const RETIRE_FROM = "2026-10-30"; // first date editable when the 12 decided-game items were retired
const ids = new Set(DAILY_ITEMS.map((i) => i.id));
const addDays = (key: string, n: number) => new Date(Date.parse(`${key}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Sets people already played (pre-#119 pack). Never change these. */
const PLAYED: Record<string, string[]> = {
  "2026-10-26": ["2022_13_DEN_BAL-2272", "2023_17_MIA_BAL-1579", "2022_12_NE_MIN-625", "2022_06_SF_ATL-3503", "2023_06_DET_TB-2394"],
  "2026-10-27": ["2022_18_NYG_PHI-3310", "2022_03_BAL_NE-819", "2023_01_DET_KC-1986", "2022_03_NO_CAR-2560", "2023_09_TB_HOU-3638"],
};

test("played days keep their original 5 (pre-#119 sets)", () => {
  for (const [d, want] of Object.entries(PLAYED)) {
    assert.deepEqual(DAYS[d], want, `schedule entry for ${d} changed`);
    assert.deepEqual(dailySet(d).map((i) => i.id), want, `dailySet(${d}) changed`);
  }
});

test("today and the past 30 days come from the schedule, unchanged", () => {
  const today = dateKey();
  assert.ok(DAYS[today], `schedule has no entry for today (${today}); run scripts/extend-daily-schedule.ts`);
  for (let i = 0; i <= 30; i++) {
    const d = addDays(today, -i);
    if (d < LAUNCH) break;
    assert.deepEqual(dailySet(d).map((x) => x.id), DAYS[d], `dailySet(${d}) differs from dailySchedule.json`);
  }
});

test("every scheduled id is in the pack; 5 distinct per day; no gaps since launch", () => {
  const dates = Object.keys(DAYS).sort();
  assert.equal(dates[0], LAUNCH);
  dates.forEach((d, i) => {
    if (i > 0) assert.equal(d, addDays(dates[i - 1], 1), `gap before ${d}`);
    assert.equal(new Set(DAYS[d]).size, DAILY_SET_SIZE, `${d} needs 5 distinct ids`);
    for (const id of DAYS[d]) assert.ok(ids.has(id), `${d}: ${id} missing from dailyPack.json`);
  });
});

test("future schedule doesn't repeat a play within a cycle", () => {
  const dates = Object.keys(DAYS).sort().filter((d) => d > "2026-10-27");
  // Window = the pool the schedule was built from (ids it actually deals), so pack rebuilds
  // that add unscheduled replacement items don't shrink or stretch the rule.
  const pool = new Set(dates.flatMap((d) => DAYS[d]));
  const w = cycleDays(DAILY_ITEMS.filter((i) => pool.has(i.id) && !RETIRED.has(i.id)));
  const last = new Map<string, number>();
  dates.forEach((d, i) => {
    for (const id of DAYS[d]) {
      const prev = last.get(id);
      assert.ok(prev == null || i - prev >= w, `${id} repeats on ${d} within ${w} days`);
      last.set(id, i);
    }
  });
});

test("no retired id is scheduled on or after the retirement date", () => {
  assert.ok(RETIRED.size >= 12);
  for (const [d, day] of Object.entries(DAYS)) {
    if (d < RETIRE_FROM) continue;
    for (const id of day) assert.ok(!RETIRED.has(id), `${d}: retired ${id} is still scheduled`);
  }
  assert.ok(DAYS["2026-10-26"].includes("2022_06_SF_ATL-3503"), "Oct 26 keeps its played set");
});
