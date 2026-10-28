import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { outcomes, cellFor } from "./outcomes";

test("4th-and-2: 807 tries, 240 gained exactly 0", () => {
  const c = cellFor(outcomes, 2, "all")!;
  assert.equal(c.tries, 807);
  assert.equal(c.counts[outcomes.bins.indexOf(0)], 240);
});
test("every cell's bars add up to its tries", () => {
  for (const c of Object.values(outcomes.cells)) {
    assert.equal(c.counts.length, outcomes.bins.length);
    assert.equal(c.counts.reduce((a, b) => a + b, 0), c.tries);
  }
});

test("outcomes.json matches data/site exactly", () => {
  const a = readFileSync(new URL("./site/outcomes.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/outcomes.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});
