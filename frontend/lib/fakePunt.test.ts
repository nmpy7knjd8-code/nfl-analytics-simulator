import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import raw from "./site/fakes.json";
import { buildRound, isCorrect, plainDesc, ratesText, situationText, whyText, ROUND_SIZE, type FakesFile } from "./fakePunt";

const file = raw as unknown as FakesFile;
const HERE = dirname(fileURLToPath(import.meta.url));

test("frontend copy matches data/site/fakes.json byte for byte", () => {
  assert.equal(readFileSync(resolve(HERE, "site/fakes.json"), "utf8"), readFileSync(resolve(HERE, "../../data/site/fakes.json"), "utf8"));
});

test("nflverse counts: 162 fakes, 90 first downs, 299 real punts, no overtime", () => {
  assert.equal(file.count, 162);
  assert.equal(file.plays.length, 162);
  assert.equal(file.first_downs, 90);
  assert.equal(file.plays.filter((p) => p.first_down === 1).length, 90);
  assert.equal(file.real_punts.length, 299);
  assert.ok(file.plays.every((p) => p.kind === "run" || p.kind === "pass"));
  assert.ok(file.real_punts.every((p) => p.kind === "punt" && p.first_down === null));
  assert.ok([...file.plays, ...file.real_punts].every((p) => p.qtr <= 4 && p.down === 4 && p.desc.length > 0));
});

test("round is deterministic per seed, 5 unique cards, answer matches the pool", () => {
  const a = buildRound(file, "2026-11-02"), b = buildRound(file, "2026-11-02");
  assert.deepEqual(a, b);
  assert.equal(a.length, ROUND_SIZE);
  assert.equal(new Set(a.map((c) => c.play)).size, ROUND_SIZE);
  for (const c of a) assert.equal(c.answer, c.play.kind === "punt" ? "real" : "fake");
});

test("about 1 in 3 cards are fakes across many rounds", () => {
  let fakes = 0, all = 0;
  for (let i = 0; i < 400; i++) for (const c of buildRound(file, `s${i}`)) { all++; if (c.answer === "fake") fakes++; }
  assert.ok(Math.abs(fakes / all - 1 / 3) < 0.04, `fake share ${fakes / all}`);
});

test("empty file gives an empty round (empty state)", () => {
  assert.deepEqual(buildRound({ ...file, plays: [], real_punts: [] }, "x"), []);
});

test("scoring: correct only when the guess matches", () => {
  const [c] = buildRound(file, "x");
  assert.equal(isCorrect(c, c.answer), true);
  assert.equal(isCorrect(c, c.answer === "fake" ? "real" : "fake"), false);
});

test("situation never gives the answer away", () => {
  for (const p of [...file.plays, ...file.real_punts]) {
    const s = situationText(p).toLowerCase();
    assert.ok(!/fake|direct snap|pass|run|first down/.test(s), s);
  }
});

test("plain text: no clock prefix, formation tag or jersey numbers; real rates shown", () => {
  const s = plainDesc("(2:59) (Punt formation) Direct snap to 41-A.Levine. 41-A.Levine up the middle to MIA 10 for 60 yards (19-J.Grant).");
  assert.equal(s, "Direct snap to A.Levine. A.Levine up the middle to MIA 10 for 60 yards (J.Grant).");
  assert.ok(plainDesc("x ".repeat(200)).length <= 151);
  assert.match(ratesText(file), /first down 90 of 162 times \(56%\)/);
  assert.match(ratesText(file), /15,231 punts/);
  const fake = { play: file.plays[0], answer: "fake" as const };
  assert.equal(whyText(fake), "It was a run out of punt formation, and got the first down.");
});

test("fan copy: no betting words, EPA or WPA", () => {
  const src = readFileSync(resolve(HERE, "fakePunt.ts"), "utf8") + readFileSync(resolve(HERE, "../components/FakePunt.tsx"), "utf8");
  assert.ok(!/\b(EPA|WPA|odds|spread|vegas|bet)\b/i.test(src.replace(/^\s*\/\/.*$/gm, "")));
});
