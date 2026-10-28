import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import raw from "./site/twopoint.json";
import { buildRound, readKicks, coachCall, KICKS_PER_ROUND, coachText, marginText, pct1, ratesLines, readTries, sameAsCoach, situationText, ROUND_SIZE, type TwoPointFile } from "./twoPoint";

const file = raw as unknown as TwoPointFile;
const HERE = dirname(fileURLToPath(import.meta.url));
const tries = readTries(file);
const kicks = readKicks(file);

test("frontend copy matches data/site/twopoint.json byte for byte", () => {
  assert.equal(readFileSync(resolve(HERE, "site/twopoint.json"), "utf8"), readFileSync(resolve(HERE, "../../data/site/twopoint.json"), "utf8"));
});

test("shown rates are the real nflverse counts", () => {
  assert.deepEqual(ratesLines(file), [
    "Extra points: good 94.4% (8,606 of 9,119)",
    "Two-point tries: good 47.5% (456 of 960)",
    "Runs 54.5% (145 of 266) · passes 44.2% (301 of 681)",
  ]);
  assert.equal(pct1({ tries: 0, made: 0 }), "—");
});

test("no win chance per choice is shown or invented", () => {
  assert.equal(file.per_choice_win_chance, null);
  const src = readFileSync(resolve(HERE, "twoPoint.ts"), "utf8") + readFileSync(resolve(HERE, "../components/TwoPoint.tsx"), "utf8");
  assert.ok(!/win chance|\bwp\b|\.wp\b/i.test(src.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "")), "TwoPoint UI must not read or show win chance");
  assert.ok(!/\b(EPA|WPA|odds|spread|vegas|bet)\b/i.test(src.replace(/^\s*\/\/.*$/gm, "")));
});

test("cards: regulation run/pass tries only (no overtime, no no_play)", () => {
  assert.equal(tries.length, 944);
  assert.ok(tries.every((t) => t.qtr <= 4 && (t.kind === "run" || t.kind === "pass")));
  assert.deepEqual(readTries({ ...file, cols: ["x"] }), []);
});

test("kicks: real late, close extra points read in their own path", () => {
  assert.equal(kicks.length, 439);
  assert.equal(kicks.filter((k) => k.made).length, 412);
  assert.ok(kicks.every((k) => k.kind === "extra_point" && k.qtr === 4));
  assert.equal(file.cols.includes("wp"), false);
});

test("rounds mix real kicks and two-point tries", () => {
  for (const d of ["2026-11-02", "2026-11-03", "2026-11-04"]) {
    const r = buildRound(tries, d, undefined, kicks);
    assert.equal(r.length, ROUND_SIZE);
    assert.equal(r.filter((t) => t.kind === "extra_point").length, KICKS_PER_ROUND);
    assert.ok(r.every((t) => t.kind !== ("no_play" as string)));
    assert.deepEqual(r, buildRound(tries, d, undefined, kicks));
  }
});

test("Kick can match the coach on a real extra point", () => {
  const k = kicks[0];
  assert.equal(coachCall(k), "kick");
  assert.equal(sameAsCoach(k, "kick"), true);
  assert.equal(sameAsCoach(k, "run"), false);
  assert.equal(coachText({ ...k, made: true }), "Kicked the extra point. Good, 1 point.");
  assert.equal(coachText({ ...k, made: false }), "Kicked the extra point. No good.");
});

test("round is deterministic per seed with no repeats; empty pool gives empty round", () => {
  const a = buildRound(tries, "2026-11-02");
  assert.deepEqual(a, buildRound(tries, "2026-11-02"));
  assert.equal(a.length, ROUND_SIZE);
  assert.equal(new Set(a).size, ROUND_SIZE);
  assert.notDeepEqual(a, buildRound(tries, "2026-11-03"));
  assert.deepEqual(buildRound([], "x"), []);
});

test("scoring: same call as the coach (go for two with the same play type)", () => {
  const t = tries.find((x) => x.kind === "run")!;
  assert.equal(sameAsCoach(t, "run"), true);
  assert.equal(sameAsCoach(t, "pass"), false);
  assert.equal(sameAsCoach(t, "kick"), false);
});

test("plain text", () => {
  assert.equal(marginText(0), "tied");
  assert.equal(marginText(-22), "down 22");
  assert.equal(marginText(5), "up 5");
  const t = { ...tries[0], clock: "09:19", qtr: 4, diff: -22, team: "ATL", kind: "pass" as const, made: false };
  assert.equal(situationText(t), "ATL just scored a touchdown. They're down 22 with 9:19 left in the 4th.");
  assert.equal(coachText(t), "Went for two with a pass. No good.");
});
