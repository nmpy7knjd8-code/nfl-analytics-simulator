import { test } from "node:test";
import assert from "node:assert/strict";
import { agreedCount, challengeFor, decodeChallenge, encodeChallenge } from "./challenge";

test("round trip", () => {
  const h = encodeChallenge(300, ["go", "fg", "punt", "go", "go"]);
  assert.equal(h, "c=300.gkpgg");
  assert.deepEqual(decodeChallenge("#" + h), { day: 300, picks: ["go", "fg", "punt", "go", "go"] });
});

test("tampered, short, other-day links fall back without throwing", () => {
  for (const h of ["#c=300.gkx", "#c=abc.ggggg", "#c=300.", "#c=300.gggggggggggg", "#p=gg", "#c=300.gkpgg<script>"]) {
    assert.equal(decodeChallenge(h), null, h);
  }
  assert.deepEqual(challengeFor("#c=300.gkp", 300, 5), { kind: "bad" });
  assert.deepEqual(challengeFor("#c=299.gkpgg", 300, 5), { kind: "bad" });
  assert.deepEqual(challengeFor("", 300, 5), { kind: "none" });
  assert.equal(challengeFor("#c=300.gkpgg", 300, 5).kind, "ok");
});

test("agreement count", () => {
  assert.equal(agreedCount(["go", "fg", "punt", "go", "go"], ["go", "punt", "punt", "fg", "go"]), 3);
});
