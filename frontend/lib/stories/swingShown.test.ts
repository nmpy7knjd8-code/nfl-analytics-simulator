import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { points, pct, signedPct, shownDelta, type Swing } from "./swings";
import { keyFourths } from "./keyFourths";

const mk = (b: number, a: number) => ({ wp_before: b, wp_after: a, swing: a - b }) as Swing;

test("headline equals the difference of the shown numbers (70% -> 75% is 5, not 6)", () => {
  const s = mk(0.6951, 0.7549);
  assert.equal(points(s), pct(s.wp_after) - pct(s.wp_before));
  assert.equal(points(s), 5);
  assert.equal(signedPct(s), "+5%");
  for (let i = 0; i < 2000; i++) {
    const b = Math.random(), a = Math.random();
    const x = mk(b, a);
    assert.equal(points(x), Math.abs(pct(a) - pct(b)));
    assert.equal(signedPct(x).startsWith("+"), pct(a) >= pct(b));
  }
});

test("every published swing row headline matches its shown numbers", () => {
  const f = "../data/derived/swings.json";
  if (!existsSync(f)) return;
  const d = JSON.parse(readFileSync(f, "utf8"));
  for (const s of [...d.top, ...Object.values(d.weeks)] as Swing[]) assert.equal(points(s), Math.abs(pct(s.wp_after) - pct(s.wp_before)));
});

test("C1 key 4th-down swing uses rounded shown values", () => {
  const k = keyFourths([{ play_id: 1, qtr: 4, clock: "05:00", down: 4, ydstogo: 2, yardline_100: 40, posteam: "SEA", play_type: "pass", home_wp: 0.5049, home_wp_after: 0.6551 } as never], "SEA", "KC");
  assert.equal(k[0].swing, shownDelta(0.5049, 0.6551));
  assert.equal(k[0].swing, 16);
});
