import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DAILY_ITEMS, MAX_FG_YARDS, optionStates, scoreCall } from "./daily";
import { checkSituation, fieldText, gridValues, situationFromItem, whatCouldChange, type FourthDownGrid } from "./checker";
import type { QuizChoice } from "./quiz";
import type { GameFile } from "./gameStory";

const grid = JSON.parse(readFileSync(new URL("../public/data/fourth_down/grid.json", import.meta.url), "utf8")) as FourthDownGrid;
const PICKS: QuizChoice[] = ["go", "fg", "punt"];

test("C7: checker and quiz return identical values and verdicts for the same situation (all 365 Daily plays)", () => {
  assert.equal(DAILY_ITEMS.length, 365);
  for (const item of DAILY_ITEMS) {
    const r = checkSituation(situationFromItem(item), grid);
    assert.ok(r, item.id);
    assert.deepEqual(r.item.reveal.values, item.reveal.values, item.id);
    assert.deepEqual(r.options, optionStates(item), item.id);
    for (const pick of PICKS) assert.deepEqual(scoreCall(pick, r.item), scoreCall(pick, item), `${item.id} ${pick}`);
  }
});

test("Daily pack values equal the engine values in the game file for the same real play", () => {
  const file = JSON.parse(readFileSync(new URL("../public/data/games/2023_01_DET_KC.json", import.meta.url), "utf8")) as GameFile;
  const item = DAILY_ITEMS.find((i) => i.id === "2023_01_DET_KC-1986")!;
  const play = file.plays.find((p) => p.play_id === 1986)!;
  assert.deepEqual(item.reveal.values, play.fourth_down!.wp);
  assert.equal(scoreCall("go", item).best, play.fourth_down!.recommendation);
});

test("grid cells come out exactly as the engine stored them (×1/scale)", () => {
  // Q4 5:00, tied, 4th & 2 at opp 30 → cell from the file
  const ti = grid.axes.time.findIndex((t) => t.qtr === 4 && t.quarter_seconds_remaining === 300);
  const si = grid.axes.score_differential.indexOf(0);
  const di = grid.axes.distance.indexOf(2);
  const raw = grid.cells[((ti * 13 + si) * 9 + di) * 99 + 29]!;
  const g = gridValues(grid, { distance: 2, yardline_100: 30, posteam_score: 10, defteam_score: 10, qtr: 4, quarter_seconds_remaining: 300, posteam_timeouts: 3, defteam_timeouts: 3 })!;
  assert.equal(g.values.go, raw[0]! / 10000);
  assert.equal(g.values.fg, raw[1]! / 10000);
  assert.equal(g.values.punt, raw[2] == null ? undefined : raw[2] / 10000);
});

test("C7: no out-of-range FG is ever offered (every grid cell and every Daily play)", () => {
  for (const t of grid.axes.time)
    for (const d of grid.axes.score_differential)
      for (const dist of grid.axes.distance)
        for (let yl = 1; yl <= 99; yl++) {
          const r = checkSituation({ distance: dist, yardline_100: yl, posteam_score: Math.max(0, d), defteam_score: Math.max(0, -d), qtr: t.qtr, quarter_seconds_remaining: t.quarter_seconds_remaining, posteam_timeouts: 3, defteam_timeouts: 3 }, grid, []);
          if (!r) continue;
          const fg = r.options.find((o) => o.id === "fg")!;
          if (yl + 17 > MAX_FG_YARDS) {
            assert.ok(fg.disabled, `yl ${yl}`);
            assert.equal(r.item.reveal.values.fg, undefined, `yl ${yl} has fg value`);
            assert.notEqual(r.best, "fg");
          }
        }
  for (const item of DAILY_ITEMS) {
    const fg = optionStates(item).find((o) => o.id === "fg")!;
    if (item.situation.yardline_100 + 17 > MAX_FG_YARDS) assert.ok(fg.disabled, item.id);
  }
});

test("grid lookups say what they assumed; timeouts never silently change the numbers", () => {
  const r = checkSituation({ distance: 7, yardline_100: 60, posteam_score: 3, defteam_score: 9, qtr: 2, quarter_seconds_remaining: 200, posteam_timeouts: 1, defteam_timeouts: 3 }, grid, [])!;
  assert.equal(r.source.kind, "grid");
  if (r.source.kind !== "grid") return;
  assert.ok(r.source.assumptions.some((a) => a.includes("timeouts")));
  assert.ok(r.source.assumptions.some((a) => a.includes("clock is read as 2:00")));
  assert.ok(r.source.assumptions.some((a) => a.includes("4th & 6") || a.includes("4th & 8")));
});

test("OT is not in the grid: no made-up numbers", () => {
  assert.equal(checkSituation({ distance: 1, yardline_100: 40, posteam_score: 7, defteam_score: 7, qtr: 5, quarter_seconds_remaining: 300, posteam_timeouts: 2, defteam_timeouts: 2 }, grid, []), null);
});

test("field position reads own/opp; what-could-change lists only real flips", () => {
  assert.equal(fieldText(55), "own 45");
  assert.equal(fieldText(50), "midfield");
  assert.equal(fieldText(38), "opp 38");
  const sit = { distance: 2, yardline_100: 45, posteam_score: 17, defteam_score: 20, qtr: 4, quarter_seconds_remaining: 300, posteam_timeouts: 3, defteam_timeouts: 3 };
  const r = checkSituation(sit, grid, [])!;
  for (const line of whatCouldChange(sit, grid, r.best)) assert.match(line, /becomes the call\.$/);
});
