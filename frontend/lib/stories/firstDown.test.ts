import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isFirstDownDoc, isGood, outcomeText, pct, plays, situation, weekSet, whyText, type FdPlay } from "./firstDown";

const raw = readFileSync(new URL("../../public/data/stories/firstdown.json", import.meta.url), "utf8");
const doc = JSON.parse(raw);

test("public copy is identical to data/site/firstdown.json", () => {
  assert.equal(raw, readFileSync(new URL("../../../data/site/firstdown.json", import.meta.url), "utf8"));
  assert.ok(isFirstDownDoc(doc));
});

test("first real play reads cleanly", () => {
  const p = plays(doc)[0];
  assert.equal(situation(p), "Q1 · 7:22 · 1st & 10 at own 41 · DET trails 0–3");
  assert.equal(outcomeText(p), "Pass for 15 yards and a first down.");
  assert.ok(isGood(p));
});

test("good = 4+ yards, a first down or TD, never a turnover", () => {
  const b = plays(doc)[0];
  const m = (o: Partial<FdPlay>): FdPlay => ({ ...b, ...o });
  assert.ok(isGood(m({ result: "GAIN", yards: 4 })));
  assert.ok(!isGood(m({ result: "GAIN", yards: 3 })));
  assert.ok(isGood(m({ result: "TD", yards: 2 })));
  assert.ok(!isGood(m({ result: "FUM", yards: 12 })));
  assert.ok(!isGood(m({ result: "INT", yards: 0 })));
  assert.equal(outcomeText(m({ call: "run", result: "GAIN", yards: -2 })), "Run for a loss of 2 yards.");
});

test("a week is 5 plays, stable within the week, different the next", () => {
  const a = weekSet(doc, new Date(2026, 10, 2)), b = weekSet(doc, new Date(2026, 10, 8)), c = weekSet(doc, new Date(2026, 10, 9));
  assert.equal(a.length, 5);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.deepEqual(weekSet({ ...doc, plays: [] }, new Date()), []);
});

test("wording: percent, no EPA/WPA/xpass, no ids or betting words", () => {
  assert.equal(pct(doc.league.pass.good), "54%");
  assert.equal(pct(0.001), "<1%");
  for (const p of plays(doc)) assert.doesNotMatch(`${situation(p)} ${outcomeText(p)} ${whyText(p)}`, /EPA|WPA|xpass|expected|_|odds|bet|\bpoints?\b/i);
});

test("QA N2: reveal Why says why the play was good or not, not the league rate", () => {
  const b = plays(doc)[0];
  const m = (o: Partial<FdPlay>): FdPlay => ({ ...b, ...o });
  assert.equal(whyText(m({ call: "run", result: "GAIN", yards: 2 })), "Why: a 2-yard gain on 1st & 10 leaves 2nd & 8, short of a good start.");
  assert.equal(whyText(m({ call: "run", result: "1D", yards: 12 })), "Why: that run picked up a first down and kept the drive going.");
  assert.equal(whyText(m({ call: "pass", result: "TD", yards: 8 })), "Why: that play scored a touchdown.");
  assert.equal(whyText(m({ call: "pass", result: "INC", yards: 0 })), "Why: the incompletion left 2nd & 10, no closer to a first down.");
  assert.equal(whyText(m({ call: "pass", result: "INT", yards: 0 })), "Why: the interception ended the drive and gave the other team the ball.");
  assert.equal(whyText(m({ call: "run", result: "FUM", yards: 5 })), "Why: the fumble ended the drive and gave the other team the ball.");
  assert.equal(whyText(m({ call: "pass", result: "GAIN", yards: 6 })), "Why: a 6-yard gain on 1st & 10 is a good start, even without a first down.");
  assert.equal(whyText(m({ call: "run", result: "GAIN", yards: 0 })), "Why: no gain left 2nd & 10, no closer to a first down.");
  assert.equal(whyText(m({ call: "run", result: "GAIN", yards: -2 })), "Why: a loss of 2 yards made the next down longer.");
  assert.doesNotMatch(whyText(m({ result: "GAIN", yards: 2 })), /54%|49%|Since 2019/i);
});
