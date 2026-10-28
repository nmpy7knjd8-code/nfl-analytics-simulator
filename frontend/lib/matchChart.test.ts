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

test("charts/2019.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2019.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2019.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("charts/2020.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2020.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2020.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("charts/2021.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2021.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2021.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("charts/2022.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2022.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2022.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("charts/2023.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2023.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2023.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("charts/2024.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2024.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2024.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});

test("charts/2025.json matches data/site exactly", () => {
  const a = readFileSync(new URL("../public/data/charts/2025.json", import.meta.url), "utf8");
  const b = readFileSync(new URL("../../data/site/charts/2025.json", import.meta.url), "utf8");
  assert.equal(a, b);
  assert.equal(typeof JSON.parse(a).dataThrough, "string");
});
