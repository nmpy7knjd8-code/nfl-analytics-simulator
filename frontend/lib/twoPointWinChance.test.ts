import { test } from "node:test";
import assert from "node:assert/strict";
import file from "./site/twopoint.json";
import { readTries, type TwoPointFile } from "./twoPoint";
import { winChanceRow } from "./twoPointWinChance";
import { CHECKER_ENABLED } from "./features";

const tries = readTries(file as unknown as TwoPointFile);
const base = tries.find((t) => t.wp_before != null && t.wp_after != null)!;

test("B1: flag is committed off, and off hides the row", () => {
  assert.equal(CHECKER_ENABLED, false);
  assert.equal(winChanceRow(base), null);
  assert.equal(winChanceRow(base, false), null);
});

test("B1: wording is % only, rounded per shown number", () => {
  const r = winChanceRow({ ...base, team: "DET", wp_before: 0.384, wp_after: 0.4051 }, true)!;
  assert.equal(r.text, "DET win chance: 38% \u2192 41% after the try");
  assert.deepEqual([r.before, r.after], [38, 41]);
  assert.doesNotMatch(r.text, /point|odds|EPA|WPA/i);
});

test("B1: hidden for overtime or null values", () => {
  assert.equal(winChanceRow({ ...base, qtr: 5 }, true), null);
  assert.equal(winChanceRow({ ...base, wp_before: null }, true), null);
  assert.equal(winChanceRow({ ...base, wp_after: null }, true), null);
});

test("B1: real data carries wp for the trying team on regulation tries", () => {
  assert.ok(tries.length > 900);
  assert.ok(tries.filter((t) => winChanceRow(t, true)).length > 900);
});

test("B1: WinChanceLine renders nothing when CHECKER_ENABLED is false", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { WinChanceLine } = await import("../components/TwoPoint");
  assert.equal(CHECKER_ENABLED, false);
  assert.equal(renderToStaticMarkup(createElement(WinChanceLine, { t: base })), "");
});
