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
    if (pct(a) !== pct(b)) assert.equal(signedPct(x).startsWith("+"), pct(a) > pct(b));
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

import { swingLine, top25, swingPctText } from "./swings";
import { facts } from "./narrator";

test("no shown swing reads 0%: sub-1 shows <1%", () => {
  const s = mk(0.501, 0.504);
  assert.equal(swingLine(s), "Win chance swung <1%");
  assert.equal(signedPct(s), "+<1%");
  assert.equal(signedPct(mk(0.504, 0.501)), "\u2212<1%");
  assert.equal(swingPctText(0), "<1%");
  assert.ok(!/\b0%/.test(swingLine(mk(0.7049, 0.6951))));
  const f = facts({ qtr: 2, clock: "05:00", posteam: "SEA", play_type: "pass", desc: "x", down: 1, ydstogo: 10, home_wp: 0.501, home_wp_after: 0.504, swing: true, home_score: 0, away_score: 0 } as never, "SEA", "KC");
  assert.equal(f.swing, "<1");
});

test("display-only: ranking uses unrounded swing", () => {
  // shown values tie at 5 but raw 0.0598 must outrank raw 0.0502
  const a = mk(0.6951, 0.7549), b = mk(0.7049, 0.7551);
  const rows = [b, a].map((r, i) => ({ ...r, qtr: 1, game_id: "g" + i }));
  assert.equal(top25(rows)[0].swing, a.swing);
});
