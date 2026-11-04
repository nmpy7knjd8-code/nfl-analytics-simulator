import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import raw from "./site/twopoint.json";
import { buildRound, readKicks, coachCall, KICKS_PER_ROUND, coachText, marginText, otherTriesNote, pct1, ratesLines, readTries, sameAsCoach, situationText, ROUND_SIZE, type TwoPointFile } from "./twoPoint";

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
    "Runs 54.9% (147 of 268) · passes 44.7% (309 of 692)",
  ]);
  assert.equal(pct1({ tries: 0, made: 0 }), "—");
  const tp = file.two_point;
  assert.equal(tp.run.tries + tp.pass.tries, 960); // 13 penalty-after-play tries labelled run/pass (nflverse pass_attempt)
  assert.equal(tp.run.made + tp.pass.made, 456);
  assert.equal(otherTriesNote(file), null);
  assert.equal(otherTriesNote({ ...file, two_point: { ...tp, tries: 973, made: 466 } }), "Includes 13 tries (10 good) wiped out by penalties or kneels.");
  
});

test("win chance only via the flag-gated B1 row; the UI never reads per_choice_win_chance", () => {
  const src = readFileSync(resolve(HERE, "twoPoint.ts"), "utf8") + readFileSync(resolve(HERE, "../components/TwoPoint.tsx"), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/win chance|\bwp\b|\.wp\b/i.test(code), "TwoPoint UI shows win chance only through winChanceRow (B1, CHECKER_ENABLED)");
  assert.ok(readFileSync(resolve(HERE, "twoPointWinChance.ts"), "utf8").includes("CHECKER_ENABLED"));
  assert.ok(!src.includes("per_choice_win_chance"), "TwoPoint UI must not read per_choice_win_chance");
  const page = readFileSync(resolve(HERE, "../app/two-point/page.tsx"), "utf8");
  assert.ok(!/win chance|per_choice/i.test(page));
  const copy = [...ratesLines(file), otherTriesNote(file) ?? "", ...tries.slice(0, 50).map(situationText), ...kicks.slice(0, 50).map(situationText), ...tries.slice(0, 50).map(coachText)].join("\n");
  assert.ok(!/win chance|\d+% to win/i.test(copy), "rendered copy must not show win chance");
  assert.ok(!/\b(EPA|WPA|odds|spread|vegas|bet)\b/i.test(src.replace(/^\s*\/\/.*$/gm, "")));
});

test("cards: regulation run/pass tries only (no overtime, no no_play)", () => {
  assert.equal(tries.length, 957); // 960 minus 3 overtime tries
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

test("QA copy: League labels, match header, result line, league match line", async () => {
  const m = await import("./twoPoint");
  assert.equal(m.leagueLabel(file.extra_point), "League: 94.4%");
  assert.equal(m.matchHeader(true), "You matched the coach");
  assert.equal(m.matchHeader(false), "You didn't match the coach");
  const k = kicks.find((x) => x.made)!, miss = kicks.find((x) => !x.made)!;
  assert.equal(m.resultText(k), "Good, 1 point");
  assert.equal(m.resultText(miss), "No good");
  assert.equal(m.leagueMatchText(file, k), "Most extra points are good. The league converts 94.4%.");
  assert.equal(m.leagueMatchText(file, miss), "Most extra points are good. The league converts 94.4%.");
  const p = tries.find((x) => x.kind === "pass" && !x.made)!;
  assert.equal(m.leagueMatchText(file, p), "Most two-point passes fail. The league converts 44.7%.");
  const run = tries.find((x) => x.kind === "run")!;
  assert.match(m.leagueMatchText(file, run), /^Most two-point runs (are good|fail)\. The league converts \d+\.\d%\.$/);
  for (const t of [...tries, ...kicks]) assert.ok(!/win chance|% to win/i.test(m.leagueMatchText(file, t) + m.resultText(t) + m.coachCallText(t)));
});

test("verdict line: Q4 score margin only, no win chance or points-per-try", async () => {
  const m = await import("./twoPoint");
  const base = tries.find((x) => x.qtr === 4)!;
  const at = (qtr: number, diff: number) => m.verdictText(file, { ...base, qtr, diff });
  assert.equal(at(4, -2), "Down 2: going for two ties it, a kick doesn't.");
  assert.equal(at(4, -5), "Down 5: two makes it a field-goal game, a kick leaves them down 4.");
  assert.equal(at(4, 1), "Up 1: two puts them up 3, so a field goal only ties. A kick leaves them up 2.");
  assert.equal(at(4, 4), "Up 4: two puts them up 6, so the other team needs a touchdown and the extra point to win. A kick leaves them up 5.");
  assert.equal(at(4, 0), "Tied: two puts them up 2, a kick up 1. A field goal beats either.");
  // Q4, not a clear case.
  for (const d of [-8, -7, -3, -1, 2, 3, 5, 7, 14]) assert.equal(at(4, d), m.NEUTRAL_LINE);
  // Early game, even on a clear margin.
  for (const q of [1, 2, 3]) for (const d of [-2, -5, 1, 4, 0, 6]) assert.equal(at(q, d), "Early on, both choices average about one point.");
  // Overtime: never a margin line, never "Early on".
  for (const d of [-2, 0, 1]) assert.equal(at(5, d), "Both choices average about one point.");
  // No score data.
  assert.equal(at(4, NaN), m.NEUTRAL_LINE);
  assert.equal(m.verdictText(file, { ...base, diff: undefined as unknown as number }), m.NEUTRAL_LINE);
  assert.equal(m.verdictText(file, { ...base, qtr: NaN }), m.NEUTRAL_LINE);
  // Made or missed and play type don't change it; per_choice_win_chance is never read.
  const poisoned = { ...file, per_choice_win_chance: { boom: true } } as unknown as typeof file;
  for (const t of [...tries, ...kicks]) {
    const v = m.verdictText(poisoned, t);
    assert.equal(v, m.verdictText(file, { ...t, made: !t.made }));
    assert.ok(!/win chance|expected|EPA|WPA|odds|bet\b|per try|a try|Tough|Good call|Even call/i.test(v), v);
  }
  // Real data has every clear case.
  for (const d of [-2, -5, 1, 4, 0]) assert.ok([...tries, ...kicks].some((t) => t.qtr === 4 && t.diff === d), String(d));
});
