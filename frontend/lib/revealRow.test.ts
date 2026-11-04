import { test } from "node:test";
import assert from "node:assert/strict";
import { revealRow } from "./revealRow";

const base = { inconclusive: true, recommendation: "inconclusive", nearTie: ["go", "punt"], off: false };

test("P1-E: Correct top pick on a close call gets is-rec (never the miss outline)", () => {
  const r = revealRow("go", { ...base, result: "correct", selected: "go" });
  assert.equal(r.rec, true);
  assert.equal(r.picked, true);
  assert.equal(r.tag, "Your pick");
  assert.equal(revealRow("punt", { ...base, result: "correct", selected: "go" }).tag, "About as good");
});

test("P2-H: on a Close call the better option is tagged Best and not rec-outlined as the pick", () => {
  const pick = revealRow("punt", { ...base, result: "near_tie", selected: "punt" });
  assert.equal(pick.rec, false);
  const best = revealRow("go", { ...base, result: "near_tie", selected: "punt" });
  assert.deepEqual([best.close, best.tag], [true, "Best"]);
});

test("clear call: wrong pick is not rec; recommendation tagged Best", () => {
  const b = { ...base, inconclusive: false, recommendation: "go" };
  assert.equal(revealRow("punt", { ...b, result: "incorrect", selected: "punt" }).rec, false);
  assert.equal(revealRow("go", { ...b, result: "incorrect", selected: "punt" }).tag, "Best");
  assert.equal(revealRow("fg", { ...b, result: "incorrect", selected: "punt", off: true }).rec, false);
});

test("M13: JAX-TB close call tags only the single top value Best", () => {
  const s = { ...base, result: "near_tie", selected: "go", nearTie: ["fg", "go", "punt"], shown: { fg: "0.8%", go: "0.7%", punt: "0.6%" } };
  const tags = ["go", "fg", "punt"].map((id) => revealRow(id, s).tag);
  assert.deepEqual(tags, ["Your pick", "Best", "About as good"]);
  assert.equal(tags.filter((t) => t === "Best").length, 1);
});

test("M13: ARI-KC values equal at display precision get no Best", () => {
  const s = { ...base, result: "near_tie", selected: "fg", nearTie: ["go", "punt", "fg"], shown: { go: "0.1%", punt: "0.1%", fg: "0.1%" } };
  assert.deepEqual(["fg", "go", "punt"].map((id) => revealRow(id, s).tag), ["Your pick", "About as good", "About as good"]);
});
