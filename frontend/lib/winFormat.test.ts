import { test } from "node:test";
import assert from "node:assert/strict";
import { gapPoints, gapSentence, pct, ptsBadge } from "./winFormat";

test("P1-B: whole numbers, gaps in points, next-best named", () => {
  assert.equal(pct(0.347), "35%");
  assert.equal(gapPoints(0.023), "2 points");
  assert.equal(gapPoints(0.004), "less than 1 point");
  assert.equal(gapPoints(0.01), "1 point");
  assert.equal(ptsBadge(0.1), "+10 pts");
  assert.equal(ptsBadge(-0.055), "-6 pts");
  assert.equal(
    gapSentence("punt", 0.347, "go", 0.324, "the Chargers"),
    "Punting gave the Chargers about 2 more points of win chance than going for it (35% vs 32%).",
  );
  assert.doesNotMatch(gapSentence("go", 0.6, "fg", 0.5, "x"), /\d\.\d/);
});
