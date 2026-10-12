import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  QUIZ_ITEMS,
  emptySession,
  scoreQuizChoice,
  updateSession,
} from "./quiz";

describe("fourth-down quiz pack + scoring", () => {
  it("auto-starts with ≥5 curated situations including flip", () => {
    assert.ok(QUIZ_ITEMS.length >= 5);
    const flip = QUIZ_ITEMS.find((i) => i.id === "flip-lac-den");
    assert.ok(flip);
    assert.equal(flip?.source.game_id, "2022_18_LAC_DEN");
    assert.equal(flip?.reveal.recommendation, "punt");
  });

  it("scores exact / incorrect / near-tie from baked reveal only", () => {
    const flip = QUIZ_ITEMS.find((i) => i.id === "flip-lac-den")!;
    const near = QUIZ_ITEMS.find((i) => i.reveal.inconclusive)!;
    assert.equal(scoreQuizChoice("punt", flip.reveal).result, "correct");
    assert.equal(scoreQuizChoice("go", flip.reveal).result, "incorrect");
    assert.equal(scoreQuizChoice("fg", near.reveal).result, "near_tie");
    assert.equal(scoreQuizChoice("fg", near.reveal).credit, 0.5);
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
});
