import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { goRates, kickTooFar, cellAt, engineCellAt, type GoRatesFile } from "./goRates";

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

test("gorates.json matches data/site exactly", () => {
  const a = readFileSync(new URL("./site/gorates.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/gorates.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("engine layer counts the same plays as the go-rate cells", () => {
  assert.ok(goRates.engine && goRates.engineCells);
  assert.equal(goRates.engine.version, "fourth_down_engine.v3");
  assert.deepEqual(goRates.engine.fields, ["rated", "engineGo", "engineKick", "enginePunt", "closeCalls", "wentWhenEngineGo"]);
  assert.equal(goRates.engineCells.length, goRates.cells.length);
  goRates.engineCells.forEach((row, r) => {
    assert.equal(row.length, goRates.bands.length);
    row.forEach(([rated, go, kick, punt, close, wentGo], c) => {
      const [plays, went] = goRates.cells[r][c];
      assert.equal(rated, plays);
      assert.equal(go + kick + punt, rated);
      assert.ok(close <= rated && wentGo <= Math.min(go, went));
    });
  });
  assert.deepEqual(engineCellAt(goRates, 1, 45), [356, 353, 1, 2, 157, 319]);
});
test("engine layer is optional for older files", () => {
  const { engine: _e, engineCells: _c, ...v1 } = goRates;
  assert.equal(engineCellAt(v1 as GoRatesFile, 1, 45), null);
  assert.deepEqual(cellAt(v1 as GoRatesFile, 1, 45)!.cell, goRates.cells[0][4]);
});
