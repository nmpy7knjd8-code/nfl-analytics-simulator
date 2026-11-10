import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { era, goRate } from "./era";

const pct = (s: number, k: "opp" | "mid" | "own" | "all") => goRate(era.seasons.find((x) => x.season === s)![k])!.toFixed(1);
test("verified 2019 and 2025 anchors", () => {
  assert.deepEqual(["opp", "mid", "own", "all"].map((k) => pct(2019, k as "opp")), ["25.5", "18.9", "6.7", "16.3"]);
  assert.deepEqual(["opp", "mid", "own", "all"].map((k) => pct(2025, k as "opp")), ["32.7", "29.2", "8.6", "23.3"]);
});
test("zones cover 1-99 without gaps", () => {
  const z = [...era.zones].sort((a, b) => a.min - b.min);
  assert.equal(z[0].min, 1); assert.equal(z.at(-1)!.max, 99);
  for (let i = 1; i < z.length; i++) assert.equal(z[i].min, z[i - 1].max + 1);
});
test("site copy matches data/site/era.json exactly", () => {
  const u = (p: string) => new URL(p, import.meta.url);
  assert.equal(readFileSync(u("./site/era.json"), "utf8"), readFileSync(u("../../data/site/era.json"), "utf8"));
});

const eraSrc = readFileSync(new URL("../components/EraChart.tsx", import.meta.url), "utf8");
test("EraChart uses chartStyle: horizontal grid, round-cap 2.5px lines, reduced motion, no team colors", () => {
  assert.match(eraSrc, /from "\.\.\/lib\/chartStyle"/);
  assert.match(eraSrc, /strokeLinecap=\{lineStyle\.lineCap\}/);
  assert.match(eraSrc, /strokeWidth=\{lineStyle\.strokeWidth\}/);
  assert.match(eraSrc, /chartMotionMs/);
  assert.match(eraSrc, /CSS_VARS\.gridline/);
  assert.doesNotMatch(eraSrc, /strokeDasharray/); // no vertical selection grid
  assert.doesNotMatch(eraSrc, /teamColor|#1E5BFF|#34c759|#ff9f0a|#af52de/i);
  assert.doesNotMatch(eraSrc, /\b(epa|wpa|xpass|odds|spread|vegas|bet|cover)\b/i);
  assert.match(eraSrc, /Going for it, then and now/);
  assert.match(eraSrc, /How often NFL teams went for it on 4th down, season by season\. Tap a season\./);
});
