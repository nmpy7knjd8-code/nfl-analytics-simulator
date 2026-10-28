import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeRound, score, type ChartsFile } from "./matchChart";

const file = JSON.parse(readFileSync(new URL("./__fixtures__/charts-2025.json", import.meta.url), "utf8")) as ChartsFile;

test("round is 3 distinct games and stable for a seed", () => {
  const a = makeRound(file, "2026-10-28");
  assert.equal(new Set(a.games.map((g) => g.gameId)).size, 3);
  assert.deepEqual(makeRound(file, "2026-10-28"), a);
  assert.deepEqual([...a.chartOrder].sort(), [0, 1, 2]);
});
test("charts are regulation only and in range", () => {
  for (const g of file.games) {
    assert.equal(g.wp.length, file.points);
    for (const p of g.wp) assert.ok(p >= 0 && p <= 1);
  }
  assert.ok(!file.games.some((g) => g.gameId.includes("BUF") && g.gameId.includes("CIN") && g.week === 17 && g.gameId.startsWith("2022")));
});
test("scoring", () => {
  const order = [2, 0, 1];
  assert.deepEqual(score(order, [1, 2, 0]), [true, true, true]);
  assert.deepEqual(score(order, [0, null, 2]), [false, false, false]);
});
