import { test } from "node:test";
import assert from "node:assert/strict";
import { closeCallWhy, fgTooFarButton, fgTooFarReveal } from "./closeCall";
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
