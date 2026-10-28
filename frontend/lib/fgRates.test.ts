import { test } from "node:test";
import assert from "node:assert/strict";
import { fgRates, bandsFor, bandIndexFor, FG_MAX_YARDS } from "./fgRates";

test("bands stop at 64 yards", () => {
  assert.equal(FG_MAX_YARDS, 64);
  assert.ok(fgRates.bands.every((b) => b.max <= 64));
  assert.equal(bandIndexFor(fgRates, 80), fgRates.bands.length - 1);
});
test("every rate key has one count per band, made <= tries", () => {
  for (const counts of Object.values(fgRates.rates)) {
    assert.equal(counts.length, fgRates.bands.length);
    for (const [t, m] of counts) assert.ok(m <= t);
  }
});
test("verified all-season rates", () => {
  const v = bandsFor(fgRates, "all").map((b) => b.pct!.toFixed(1));
  assert.deepEqual(v, ["97.9", "93.1", "78.7", "72.1", "61.0", "42.4"]);
});
