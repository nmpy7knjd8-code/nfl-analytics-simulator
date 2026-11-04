import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { belowCount, clockText, headline, isComebacksDoc, lowPct, lowText, rows, scoreText, sparkPath, weekText } from "./comebacks";

const raw = readFileSync(new URL("../../public/data/stories/comebacks.json", import.meta.url), "utf8");
const doc = JSON.parse(raw);

test("public copy is identical to data/site/comebacks.json", () => {
  assert.equal(raw, readFileSync(new URL("../../../data/site/comebacks.json", import.meta.url), "utf8"));
  assert.ok(isComebacksDoc(doc));
});

test("65 games were won after falling below 5% (real nflverse data)", () => {
  assert.equal(belowCount(doc), 65);
  assert.match(headline(doc), /^65 teams came back from under 5% to win since 2019, out of 1,954 games\. Here are the 50 biggest\.$/);
  assert.equal(rows(doc).length, 50);
});

test("top 50 rows read cleanly: no ids, no jersey numbers, no stat names", () => {
  const r = rows(doc);
  assert.equal(r.length, 50);
  assert.equal(r[0].gameId, "2022_15_IND_MIN");
  assert.equal(scoreText(r[0]), "MIN 39, IND 36 (won in overtime)");
  assert.equal(lowText(r[0]), "MIN fell to <1% to win in Q3 with 3:52 left");
  for (const c of r) {
    const t = `${weekText(c)} ${scoreText(c)} ${lowText(c)}`;
    assert.doesNotMatch(t, /\d{4}_\d{2}_|EPA|WPA|probability|odds|bet/i);
    assert.ok(c.spark.length >= 2 && c.spark.every((v) => v >= 0 && v <= 100));
  }
});

test("lowPct never shows 0%; spark path stays in the box", () => {
  assert.equal(lowPct(0.0011), "<1%");
  assert.equal(lowPct(0.0473), "5%");
  const p = sparkPath([0, 50, 100], 100, 40);
  assert.equal(p, "M0.0,40.0 L50.0,20.0 L100.0,0.0");
  assert.equal(sparkPath([1], 10, 10), "");
});

test("schema guard rejects bad shapes", () => {
  assert.equal(isComebacksDoc({}), false);
  assert.equal(isComebacksDoc({ ...doc, cols: ["season"] }), false);
});

test("(a) low point is regulation only: Q1-Q4, never an overtime value", () => {
  assert.match(doc.source, /regulation rows only/);
  for (const c of rows(doc)) {
    assert.ok(c.lowQtr >= 1 && c.lowQtr <= 4, `${c.gameId} low in Q${c.lowQtr}`);
    assert.doesNotMatch(lowText(c), /\bOT\b|overtime|Q5/i);
  }
});

test("(b) low reads as % win chance, never points/EPA/WPA; (c) trademark footer present", () => {
  for (const c of rows(doc)) {
    assert.match(lowText(c), /fell to (<1|\d{1,2})% to win (in Q[1-4] with \d{1,2}:\d\d left|at the end of the (1st|2nd|3rd|4th) quarter)$/);
    assert.doesNotMatch(lowText(c), /\bpts?\b|points|EPA|WPA/i);
  }
  const src = readFileSync(new URL("../../components/stories/Comebacks.tsx", import.meta.url), "utf8");
  assert.match(src, /<Trademark \/>/);
});

test("QA C3: 0:00 reads as the end of the quarter, never 'with 0:00 left'", () => {
  assert.equal(clockText(1, "00:00"), "at the end of the 1st quarter");
  assert.equal(clockText(2, "0:00"), "at the end of the 2nd quarter");
  assert.equal(clockText(3, "00:00"), "at the end of the 3rd quarter");
  assert.equal(clockText(4, "00:00"), "at the end of the 4th quarter");
  assert.equal(clockText(2, "00:05"), "with 0:05 left");
  const c = { ...rows(doc)[0], lowQtr: 3, lowClock: "00:00" };
  assert.equal(lowText(c), `${c.winner} fell to ${lowPct(c.low)} to win at the end of the 3rd quarter`);
  for (const r of rows(doc)) assert.doesNotMatch(lowText(r), /with 0:00 left/);
});
