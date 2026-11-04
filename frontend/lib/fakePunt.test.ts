import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { teamNickname } from "./teams";
import raw from "./site/fakes.json";
import fanTextsForTest from "./site/fakesText.json";
import { readFileSync } from "node:fs";
const FULL_NAMES: string[] = Object.values(JSON.parse(readFileSync(new URL("../../data/site/player_names.json", import.meta.url), "utf8")).names);
import { buildRound, isCorrect, matchupText, plainDesc, playText, ratesText, situationText, whyText, ROUND_SIZE, type FakesFile } from "./fakePunt";

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

test("N4: answer text runs through the feed cleaner, never raw nflverse desc", () => {
  const all = [...file.plays, ...file.real_punts];
  for (const p of all) {
    for (const s of [playText(p), whyText({ play: p, answer: p.kind === "punt" ? "real" : "fake" })]) {
      assert.ok(!/\(\d{0,2}:\d{2}\)|Center-|Holder-|\b\d{1,2}-[A-Z]|\(Punt formation\)/i.test(s), s);
    }
  }
  const bailey = all.find((p) => /J\.Bailey punts/.test(p.desc) && /Center-/.test(p.desc))!;
  assert.ok(bailey, "fixture play");
  assert.ok(!playText(bailey).includes("Cardona") && !playText(bailey).includes("Center"), playText(bailey));
  assert.match(playText(bailey), /^(J\.|Jake )Bailey punts \d+ yards/);
});

test("N4: setup line and matchup use team names, not codes", () => {
  const p = file.plays[0];
  assert.equal(matchupText(p), "Ravens vs Dolphins");
  assert.match(situationText(p), /^The Ravens are up 35–3, 4th & 1 at their own 30/);
  const near = file.plays.find((x) => x.yardline_100 < 50)!;
  assert.match(situationText(near), new RegExp(`at the ${teamNickname(near.opp)} ${near.yardline_100},`));
  for (const x of [...file.plays, ...file.real_punts]) assert.ok(!/\b[A-Z]{2,3}\b/.test(situationText(x) + matchupText(x)), situationText(x));
});

test("P3: answer text is never cut mid-play: no '…', ends in sentence punctuation", () => {
  for (const p of [...file.plays, ...file.real_punts]) {
    const s = whyText({ play: p, answer: p.kind === "punt" ? "real" : "fake" });
    assert.ok(!s.includes("…"), s);
    assert.match(s, /[.!?]["”)]?$/, s);
    assert.ok(s.length <= "A real punt: ".length + 150, s);
  }
  const hayball = file.real_punts.find((p) => /M\.Hayball punts 35 yards to NYG 44/.test(p.desc));
  if (hayball) assert.match(whyText({ play: hayball, answer: "real" }), /for 8 yards\.$/);
});

test("answer text uses plain names: no 'NYJ-' prefixes or team codes", () => {
  for (const p of [...file.plays, ...file.real_punts]) {
    let s = whyText({ play: p, answer: p.kind === "punt" ? "real" : "fake" }) + " " + playText(p);
    for (const n of FULL_NAMES) s = s.split(n).join("");  // full names like "AJ McCarron" are not team codes
    assert.ok(!/\b[A-Z]{2,3}-[A-Z]/.test(s), s);
    assert.ok(!/\b[A-Z]{2,3}\b/.test(s), s);
  }
  const farley = file.real_punts.find((p) => /downed by NYJ-\d+-M\.Farley/.test(p.desc));
  if (farley) assert.match(playText(farley), /downed by M\.Farley/);
});

test("full player names from player_names.json, short names when unmatched", () => {
  const texts = Object.values(fanTextsForTest);
  assert.ok(texts.some((s) => s.startsWith("Direct snap to Anthony Levine. Anthony Levine up the middle")));
  assert.ok(texts.some((s) => /recovered by B\.Skrine/.test(s)), "unmatched names keep the short form");
});

test("150 cap does not cut at an initial or Jr.", () => {
  const s = plainDesc("Chris Jones pass short left to C.J. Goodwin to the Bears 40 for 12 yards. " + "Then a long penalty note follows here. ".repeat(4));
  assert.ok(s.length <= 150 && /[.!?]$/.test(s) && !/C\.J\.$/.test(s), s);
  const j = plainDesc("R.James Jr. to the 49ers 26 for 2 yards and a lot more words follow here with no stop at all " + "x ".repeat(40));
  assert.ok(!j.endsWith("Jr."), j);
});
