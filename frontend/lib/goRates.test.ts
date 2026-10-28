import { test } from "node:test";
import assert from "node:assert/strict";
import { goRates, kickTooFar, cellAt } from "./goRates";

test("grid is distances × bands and plays add up", () => {
  assert.equal(goRates.cells.length, goRates.distances.length);
  for (const row of goRates.cells) {
    assert.equal(row.length, goRates.bands.length);
    for (const [n, g, k, p] of row) assert.equal(g + k + p, n);
  }
});
test("no kick offered past 64 yards", () => {
  assert.equal(goRates.maxFgYards, 64);
  goRates.bands.forEach((b) => { if (b.min + 18 > 64) assert.ok(kickTooFar(goRates, b)); });
});
test("cell lookup", () => {
  assert.equal(cellAt(goRates, 1, 1)!.col, 0);
  assert.equal(cellAt(goRates, 14, 99)!.row, goRates.distances.length - 1);
});
