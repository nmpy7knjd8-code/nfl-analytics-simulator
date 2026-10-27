import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CLOSE_LABEL } from "./labels";
import {
  QUIZ_ITEMS,
  availableChoices,
  emptySession,
  scoreQuizChoice,
  updateSession,
} from "./quiz";

describe("fourth-down quiz pack + scoring", () => {
  it("auto-starts with ≥365 real situations including LAC@DEN", () => {
    assert.ok(QUIZ_ITEMS.length >= 365);
    const flip = QUIZ_ITEMS.find((i) => i.id === "flip-lac-den");
    assert.ok(flip);
    assert.equal(flip?.source.game_id, "2022_18_LAC_DEN");
    assert.equal(flip?.reveal.recommendation, "punt");
  });

  it("scores exact / incorrect / near-tie from baked reveal only", () => {
    const flip = QUIZ_ITEMS.find((i) => i.id === "flip-lac-den")!;
    const near = QUIZ_ITEMS.find((i) => i.reveal.inconclusive && "fg" in i.reveal.values)!;
    assert.equal(scoreQuizChoice("punt", flip.reveal).result, "correct");
    assert.equal(scoreQuizChoice("go", flip.reveal).result, "incorrect");
    const order = (["go", "fg", "punt"] as const).filter((c) => typeof near.reveal.values[c] === "number").sort((a, b) => near.reveal.values[b]! - near.reveal.values[a]!);
    assert.equal(scoreQuizChoice(order[0], near.reveal).result, "correct");
    assert.equal(scoreQuizChoice(order[0], near.reveal).credit, 1);
  });

  it("tracks streak and accuracy", () => {
    const flip = QUIZ_ITEMS.find((i) => i.id === "flip-lac-den")!;
    let s = emptySession();
    s = updateSession(s, scoreQuizChoice("punt", flip.reveal));
    assert.equal(s.streak, 1);
    s = updateSession(s, scoreQuizChoice("go", flip.reveal));
    assert.equal(s.streak, 0);
    assert.ok(s.accuracy > 0 && s.accuracy < 1);
  });

  it("every situation is a real play a fan would believe", () => {
    for (const i of QUIZ_ITEMS) {
      const s = i.situation;
      assert.ok(/^[A-Z]{2,3}$/.test(s.posteam) && /^[A-Z]{2,3}$/.test(s.defteam), i.id);
      assert.ok(s.quarter_seconds_remaining >= 0 && s.quarter_seconds_remaining <= 900, i.id);
      assert.ok(s.qtr >= 1 && s.qtr <= 4, i.id);
      if (s.yardline_100 + 18 > 64) assert.ok(!("fg" in i.reveal.values), `${i.id} offers an out-of-range FG`);
    }
  });
});

describe("H4: only offered options, never a kick past 64 yd", () => {
  it("no FG choice when yards to the end zone + 18 is over 64", () => {
    let far = 0;
    for (const i of QUIZ_ITEMS) {
      const opts = availableChoices(i);
      if (i.situation.yardline_100 + 18 > 64) {
        far++;
        assert.ok(!opts.includes("fg"), `${i.id} offers a ${i.situation.yardline_100 + 18}-yd FG`);
      }
      for (const c of opts) assert.equal(typeof i.reveal.values[c], "number", `${i.id} shows a row with no value`);
    }
    assert.ok(far > 0);
  });

  it("a missing or too-far option never earns half credit on a close call", () => {
    const reveal = { recommendation: "inconclusive", inconclusive: true, margin: 0.01, values: { go: 0.4, punt: 0.41 }, layman_why: "" };
    assert.deepEqual([scoreQuizChoice("fg", reveal).credit, scoreQuizChoice("go", reveal).credit], [0, 0.5]);
    const fgReveal = { ...reveal, values: { go: 0.4, fg: 0.405, punt: 0.41 } };
    assert.equal(scoreQuizChoice("fg", fgReveal, { yardline_100: 50 }).credit, 0);
    assert.equal(scoreQuizChoice("fg", fgReveal, { yardline_100: 30 }).credit, 0.5);
  });

  it("2146 P2-G: on a close call the higher win chance is Correct (1), the near option ½, a far one 0", () => {
    const reveal = { recommendation: "inconclusive", inconclusive: true, margin: 0.012, values: { go: 0.231, fg: 0.1, punt: 0.243 }, layman_why: "" };
    const s = (c: "go" | "fg" | "punt") => [scoreQuizChoice(c, reveal, { yardline_100: 30 }).result, scoreQuizChoice(c, reveal, { yardline_100: 30 }).credit];
    assert.deepEqual(s("punt"), ["correct", 1]);
    assert.deepEqual(s("go"), ["near_tie", 0.5]);
    assert.deepEqual(s("fg"), ["incorrect", 0]);
    const st = updateSession(emptySession(), scoreQuizChoice("punt", reveal));
    assert.equal(st.streak, 1);
  });

  it("M8: one close-call label", () => {
    assert.equal(CLOSE_LABEL, "Close call");
  });
});
