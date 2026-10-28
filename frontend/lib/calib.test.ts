import { test } from "node:test";
import assert from "node:assert/strict";
import { calib } from "./calib";

test("verified buckets", () => {
  const b = (lo: number) => calib.buckets.find((x) => x.lo === lo)!;
  assert.deepEqual([b(0).predicted, b(0).actual, b(0).plays], [1.4, 1.8, 23201]);
  assert.deepEqual([b(5).predicted, b(5).actual, b(5).plays], [7.5, 7.6, 10792]);
  assert.deepEqual([b(40).predicted, b(40).actual], [45.0, 42.2]);
  assert.deepEqual([b(50).predicted, b(50).actual], [55.2, 52.4]);
});
test("buckets are contiguous 0-100 and in range", () => {
  calib.buckets.forEach((x, i) => {
    if (i) assert.equal(x.lo, calib.buckets[i - 1].hi);
    assert.ok(x.predicted >= 0 && x.predicted <= 100 && x.actual >= 0 && x.actual <= 100);
  });
  assert.equal(calib.buckets[0].lo, 0); assert.equal(calib.buckets.at(-1)!.hi, 100);
});
