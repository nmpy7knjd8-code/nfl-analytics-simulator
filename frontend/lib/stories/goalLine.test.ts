import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { badgeLabel, isGoalLineDoc, stopKey, stopSet } from "./goalLine";

const raw = readFileSync(new URL("../../public/data/stories/goalline.json", import.meta.url), "utf8");
const doc = JSON.parse(raw);

test("public copy is identical to data/site/goalline.json", () => {
  assert.equal(raw, readFileSync(new URL("../../../data/site/goalline.json", import.meta.url), "utf8"));
  assert.ok(isGoalLineDoc(doc));
});

test("100 real stops keyed by game, quarter and clock", () => {
  const s = stopSet(doc);
  assert.equal(doc.stops.length, 100);
  assert.ok(s.has(stopKey("2019_04_PHI_GB", 4, 548)));
  assert.ok(!s.has(stopKey("2019_04_PHI_GB", 4, 549)));
  assert.ok(!s.has(stopKey("2019_04_PHI_GB", 4, null)));
});

test("badge reads in percent from 229 tries, no ids or stat names", () => {
  assert.equal(doc.rates.tries, 229);
  assert.equal(badgeLabel(doc), "Goal-line stop. Offenses score on 56% of these tries.");
  assert.doesNotMatch(badgeLabel(doc), /EPA|WPA|odds|bet|_/);
  assert.equal(badgeLabel({ ...doc, rates: { ...doc.rates, rate: 0.001 } }), "Goal-line stop. Offenses score on <1% of these tries.");
});

test("the feed mounts the badge on plays only (no /goal-line/ page)", () => {
  const src = readFileSync(new URL("../../components/PlayFeedC6.tsx", import.meta.url), "utf8");
  assert.match(src, /goalStops\.has\(stopKey\(/);
  assert.throws(() => readFileSync(new URL("../../app/goal-line/page.tsx", import.meta.url)));
});
