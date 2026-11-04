import { test } from "node:test";
import assert from "node:assert/strict";
import { outcomes } from "./outcomes";
import { neededRate, realRate, realRateLabel, realRateText, realRateSource } from "./breakEven";

test("4th-and-1 inside the 40 uses the real nflverse cell (819 of 1,257)", () => {
  const r = realRate(1, 30)!;
  const c = outcomes.cells["1-opp"];
  assert.equal(r.converted, c.converted);
  assert.equal(r.tries, c.tries);
  assert.equal(r.pct, Math.round((100 * c.converted) / c.tries));
  assert.equal(realRateLabel(r), "Real 4th-and-1 tries inside the 40");
  assert.equal(realRateText(r), `${r.pct}% converted`);
  assert.equal(realRateSource(r), "819 of 1,257 since 2019");
});
test("long distances clamp to 10+ and zones map by yardline", () => {
  assert.equal(realRate(14, 64)!.togo, 10);
  assert.equal(realRateLabel(realRate(14, 64)!), "Real 4th-and-10+ tries on own side");
  assert.equal(realRate(3, 50)!.place, "near midfield");
});
test("bad input is empty, not invented", () => {
  assert.equal(realRate(0, 30), null);
  assert.equal(realRate(Number.NaN, 30), null);
});
test("needed rate stays hidden while the checker is off", () => {
  assert.equal(neededRate({ breakeven: 0.4 }), null);
  assert.equal(neededRate({ breakeven: 0.4 }, true), 0.4);
  assert.equal(neededRate({}, true), null);
  assert.equal(neededRate({ breakeven: 2 }, true), null);
});
test("copy has no betting or EPA words", () => {
  for (const k of Object.keys(outcomes.cells)) {
    const [t, z] = k.split("-");
    const r = realRate(Number(t), z === "opp" ? 30 : z === "mid" ? 50 : 70);
    if (r) assert.doesNotMatch(realRateLabel(r) + realRateText(r) + realRateSource(r), /odds|spread|line|EPA|WPA|vegas/i);
  }
});
