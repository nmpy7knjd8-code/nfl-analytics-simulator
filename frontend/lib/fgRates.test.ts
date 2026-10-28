import { test } from "node:test";
import assert from "node:assert/strict";
import { fgRates, bandsFor, bandIndexFor, rateAt, FG_MAX_YARDS } from "./fgRates";

test("bands and yards stop at 64", () => {
  assert.equal(FG_MAX_YARDS, 64);
  assert.equal(fgRates.maxYards, 64);
  assert.ok(fgRates.bands.every((b) => b.max <= 64));
  assert.equal(bandIndexFor(fgRates, 80), fgRates.bands.length - 1);
  for (const rows of Object.values(fgRates.yards)) assert.equal(rows.length, 64 - fgRates.minYards + 1);
});
test("every season 2019-2025 is present and sums to all", () => {
  assert.deepEqual(fgRates.seasons, [2019, 2020, 2021, 2022, 2023, 2024, 2025]);
  const all = fgRates.yards.all;
  all.forEach(([t, m], i) => {
    let st = 0, sm = 0;
    for (const s of fgRates.seasons) { st += fgRates.yards[String(s)][i][0]; sm += fgRates.yards[String(s)][i][1]; }
    assert.deepEqual([st, sm], [t, m]);
    assert.ok(m <= t);
  });
});
test("nflverse 2019-2025 band counts (REG+POST)", () => {
  const v = bandsFor(fgRates, "all").map((b) => [b.tries, b.made]);
  assert.deepEqual(v, [[1721, 1685], [2132, 1985], [2222, 1748], [1040, 750], [428, 261], [66, 28]]);
});
test("headline rate is a ±2 yard window, clamped at 64", () => {
  const r = rateAt(fgRates, "all", 64);
  assert.equal(r.lo, 62); assert.equal(r.hi, 64);
  const r45 = rateAt(fgRates, "all", 45);
  assert.equal(r45.lo, 43); assert.equal(r45.hi, 47);
  assert.ok(r45.pct! > 70 && r45.pct! < 90);
});
