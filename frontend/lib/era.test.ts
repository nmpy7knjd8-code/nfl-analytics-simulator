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
