import { test } from "node:test";
import assert from "node:assert/strict";
import { closeCallWhy, closeCallNote, fgButton, formatPercents, fgTooFarButton, fgTooFarReveal } from "./closeCall";
import { CLOSE_LABEL } from "./labels";
import { scoreQuizChoice } from "./quiz";

const reveal = (values: Record<string, number>) =>
  ({ values, recommendation: "inconclusive", inconclusive: true, layman_why: "x", margin: 0.01 }) as never;

test("P2-E: one label, plain close-call sentence", () => {
  assert.equal(CLOSE_LABEL, "Close call");
  assert.equal(
    closeCallWhy({ reveal: reveal({ go: 0.231, fg: 0.1, punt: 0.243 }), situation: { yardline_100: 60 } }),
    "Punting and going for it give about the same win chance (24% vs 23%).",
  );
});

test("P1-D: out-of-range FG is labelled and never credited", () => {
  assert.equal(fgTooFarButton({ yardline_100: 63 }), "Field goal · 81-yd kick, too far");
  assert.equal(fgTooFarReveal({ yardline_100: 63 }), "Too far (81 yd)");
  const r = scoreQuizChoice("fg", reveal({ go: 0.4, fg: 0.41, punt: 0.39 }), { yardline_100: 60 } as never);
  assert.equal(r.credit, 0);
});

test("2146 P2-G: notes use the real reveal numbers", () => {
  const item = { reveal: reveal({ go: 0.231, fg: 0.1, punt: 0.243 }), situation: { yardline_100: 60 } };
  assert.equal(closeCallNote(item, "punt", "correct"), "Going for it was about as good (23%).");
  assert.equal(closeCallNote(item, "go", "near_tie"), "Punting was a little better (24% vs 23%), so this pick gets ½.");
});

test("2220 L8: one decimal only when whole percents would match", () => {
  assert.deepEqual(formatPercents([0.621, 0.617]), ["62.1%", "61.7%"]);
  assert.deepEqual(formatPercents([0.243, 0.231]), ["24%", "23%"]);
  const item = { reveal: reveal({ go: 0.617, fg: 0.621, punt: 0.3 }), situation: { yardline_100: 20 } };
  assert.equal(closeCallNote(item, "go", "near_tie"), "Kicking a field goal was a little better (62.1% vs 61.7%), so this pick gets ½.");
  assert.equal(closeCallNote(item, "fg", "correct"), "Going for it was about as good (61.7%).");
});

test("2220 L9: in-range field goal button shows the kick distance", () => {
  assert.equal(fgButton({ yardline_100: 29 }), "Field goal · 47-yd kick");
});
