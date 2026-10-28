import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calib } from "./calib";

test("verified buckets", () => {
  const b = (lo: number) => calib.buckets.find((x) => x.lo === lo)!;
  assert.deepEqual([b(0).predicted, b(0).actual, b(0).plays], [1.5, 2.1, 29472]);
  assert.deepEqual([b(5).predicted, b(5).actual, b(5).plays], [7.4, 8.9, 13578]);
  assert.deepEqual([b(40).predicted, b(40).actual], [45.0, 42.9]);
  assert.deepEqual([b(95).predicted, b(95).actual], [98.5, 98.5]);
  assert.equal(calib.buckets.reduce((n, x) => n + x.plays, 0), 338914);
  assert.equal(calib.model, "nflverse");
  assert.deepEqual([b(50).predicted, b(50).actual], [55.1, 53.6]);
});
test("buckets are contiguous 0-100 and in range", () => {
  calib.buckets.forEach((x, i) => {
    if (i) assert.equal(x.lo, calib.buckets[i - 1].hi);
    assert.ok(x.predicted >= 0 && x.predicted <= 100 && x.actual >= 0 && x.actual <= 100);
  });
  assert.equal(calib.buckets[0].lo, 0); assert.equal(calib.buckets.at(-1)!.hi, 100);
});
test("site copy matches data/site/calib.json exactly", () => {
  const u = (p: string) => new URL(p, import.meta.url);
  assert.equal(readFileSync(u("./site/calib.json"), "utf8"), readFileSync(u("../../data/site/calib.json"), "utf8"));
});
test("fan copy has no betting or EPA words", () => {
  const src = readFileSync(new URL("../components/CalibrationChart.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /vegas|betting|odds|spread|\bEPA\b|\bWPA\b|xpass/i);
});
