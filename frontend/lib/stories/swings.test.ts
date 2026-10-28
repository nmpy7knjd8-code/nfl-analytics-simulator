import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isSwingsDoc, playText, regulation, swingLine, top25, weeksNewestFirst, situation, type Swing } from "./swings";

const doc = JSON.parse(readFileSync(new URL("../../public/data/stories/swings.json", import.meta.url), "utf8"));
const base: Swing = { game_id: "2024_08_CHI_WAS", season: 2024, week: 8, season_type: "REG", game_date: "2024-10-27", home: "WAS", away: "CHI", final_home: 18, final_away: 15, qtr: 4, clock: "00:02", offense: "WAS", down: 1, to_go: 10, text: "(:02) (No Huddle, Shotgun) 5-J.Daniels pass deep middle to 85-N.Brown for 52 yards, TOUCHDOWN.", offense_win_before: 17, offense_win_after: 100, swing_points: 83, helped: "WAS" };

test("swings.json has the v0 shape", () => assert.ok(isSwingsDoc(doc)));
test("no overtime rows and no CIN_BUF rows survive", () => {
  const rows = regulation([...doc.weeks, ...doc.top25, { ...base, qtr: 5 }, { ...base, game_id: "2019_03_CIN_BUF" }]);
  assert.ok(rows.every((r) => r.qtr <= 4 && r.game_id !== "2019_03_CIN_BUF"));
});
test("no play ids, EPA or WPA in the shipped file", () => {
  const s = JSON.stringify(doc);
  assert.ok(!/play_id|\bEPA\b|\bWPA\b|xpass/i.test(s));
});
test("top 25 is sorted and capped", () => {
  const t = top25(doc.top25);
  assert.ok(t.length <= 25);
  for (let i = 1; i < t.length; i++) assert.ok(t[i - 1].swing_points >= t[i].swing_points);
});
test("weeks newest first", () => {
  const w = weeksNewestFirst(doc.weeks);
  for (let i = 1; i < w.length; i++) assert.ok(w[i - 1].season * 100 + w[i - 1].week >= w[i].season * 100 + w[i].week);
});
test("fan copy", () => {
  assert.equal(playText(base.text), "5-J.Daniels pass deep middle to 85-N.Brown for 52 yards, TOUCHDOWN.");
  assert.equal(swingLine(base), "Chance to win swung 83 points");
  assert.equal(situation(base), "Q4 · 0:02 · 1st & 10 · WAS ball");
});
