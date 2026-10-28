import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { finalScore, isSwingsDoc, playText, points, regulation, swingLine, top25, weeksNewestFirst, situation, beforeAfter, weekLabel, type Swing } from "./swings";

const raw = readFileSync(new URL("../../public/data/stories/swings.json", import.meta.url), "utf8");
const doc = JSON.parse(raw);
const base: Swing = { season: 2024, week: 8, round: null, game_id: "2024_08_CHI_WAS", home: "WAS", away: "CHI", team: "WAS", qtr: 4, clock: "00:02", down: 1, togo: 10, yardline_100: 52, play_type: "pass", desc: "(:02) (No Huddle, Shotgun) 5-J.Daniels pass deep middle to 85-N.Brown for 52 yards, TOUCHDOWN.", wp_before: 0.0975, wp_after: 1, swing: 0.9025 };

test("public copy is identical to data/site/swings.json (CI-built by Data Builders)", () => {
  assert.equal(raw, readFileSync(new URL("../../../data/site/swings.json", import.meta.url), "utf8"));
});
test("swings.json is v1", () => assert.ok(isSwingsDoc(doc)));
test("no overtime and no CIN_BUF rows survive", () => {
  const rows = regulation([...Object.values(doc.weeks) as Swing[], ...doc.top, { ...base, qtr: 5 }, { ...base, game_id: "2019_03_CIN_BUF" }]);
  assert.ok(rows.every((r) => r.qtr <= 4 && r.game_id !== "2019_03_CIN_BUF"));
});
test("C3 top 4 matches the verified list (Daniels, Carr, Allen, Gay)", () => {
  const t = top25(doc.top);
  assert.equal(t.length, 25);
  const want: [string, number][] = [["WAS", 90.2], ["LV", 76.9], ["BUF", -75.7], ["TB", -75.3]];
  t.slice(0, 4).forEach((s, i) => { assert.equal(s.team, want[i][0]); assert.ok(Math.abs(s.swing * 100 - want[i][1]) < 0.06, `${s.team} ${s.swing}`); });
});
test("weeks newest first; Super Bowl label for round SB", () => {
  const w = weeksNewestFirst(doc.weeks);
  for (let i = 1; i < w.length; i++) assert.ok(w[i - 1].season * 100 + w[i - 1].week >= w[i].season * 100 + w[i].week);
  assert.equal(weekLabel({ season: 2025, week: 22, round: "SB" }), "Super Bowl, 2025");
});
test("fan copy: no jersey numbers, no stat names", () => {
  assert.equal(playText(base.desc), "J.Daniels pass deep middle to N.Brown for 52 yards, TOUCHDOWN.");
  assert.equal(playText("9-M.Gay 34 yard field goal is No Good, Center-97-Z.Triner, Holder-8-B.Pinion."), "M.Gay 34 yard field goal is No Good, Center-Z.Triner, Holder-B.Pinion.");
  assert.equal(swingLine(base), "Chance to win swung 90 points");
  assert.equal(points({ ...base, swing: -0.757 }), 76);
  assert.equal(beforeAfter(base), "WAS 10% → 100% to win");
  assert.equal(situation(base), "Q4 · 0:02 · 1st & 10 · WAS ball");
  for (const s of doc.top as Swing[]) assert.ok(!/\b(EPA|WPA|xpass)\b|\d{1,2}-[A-Z]/.test(playText(s.desc)), playText(s.desc));
});

test("QA weeks: 2019-w01 Lutz +42.8 NO, 2024-w19 Mayfield fumble -25.8 TB, no REVERSED, scores present", () => {
  const d = JSON.parse(readFileSync(new URL("../../public/data/stories/swings.json", import.meta.url), "utf8"));
  const a = d.weeks["2019-w01"], b = d.weeks["2024-w19"];
  assert.equal(`${a.away}-${a.home}`, "HOU-NO"); assert.match(a.desc, /Lutz.*58-yard field goal/); assert.equal(a.team, "NO");
  assert.ok(Math.abs(a.swing * 100 - 42.8) < 0.06);
  assert.equal(`${b.away}-${b.home}`, "WAS-TB"); assert.match(b.desc, /Mayfield/); assert.match(b.desc, /fumble/i);
  assert.ok(Math.abs(b.swing * 100 + 25.8) < 0.06, String(b.swing));
  assert.ok(!/REVERSED/i.test(JSON.stringify(d)));
  assert.equal(finalScore(a), "Final: HOU 28, NO 30");
  assert.equal(playText("Pass to [79-J.Cominsky] x"), "Pass to [J.Cominsky] x");
});
