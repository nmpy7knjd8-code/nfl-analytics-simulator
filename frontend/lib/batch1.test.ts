import { test } from "node:test";
import assert from "node:assert/strict";
import { archiveKey, calibrationScore, challengeQuery, coachTally, readChallenge } from "./batch1";
import { DAILY_ITEMS, dailySet, rankedValues } from "./daily";

test("?d= archive: only real past dates from set #1", () => {
  assert.equal(archiveKey("2026-10-01", "2026-10-26"), "2026-10-01");
  for (const bad of ["2026-10-26", "2026-11-01", "2025-12-31", "2026-02-30", "x", null]) assert.equal(archiveKey(bad, "2026-10-26"), null, String(bad));
});

test("challenge link round-trips and rejects options the set doesn't offer", () => {
  const key = "2026-10-20";
  const picks = dailySet(key).map((it) => rankedValues(it)[0][0]);
  const q = challengeQuery(key, picks);
  assert.deepEqual(readChallenge(new URLSearchParams(q), "2026-10-26"), { key, picks });
  assert.equal(readChallenge(new URLSearchParams("d=2026-10-20&c=gg"), "2026-10-26"), null);
  const far = dailySet(key).findIndex((it) => !rankedValues(it).some(([id]) => id === "fg"));
  if (far >= 0) {
    const c = q.split("c=")[1].split("");
    c[far] = "k";
    assert.equal(readChallenge(new URLSearchParams(`d=${key}&c=${c.join("")}`), "2026-10-26"), null);
  }
});

test("Coach vs. You: agreed and beat from real coach calls", () => {
  const it = DAILY_ITEMS.find((i) => i.historical_action && rankedValues(i).length > 1 && rankedValues(i)[0][0] !== i.historical_action)!;
  const best = rankedValues(it)[0][0];
  const t = coachTally([{ id: it.id, pick: it.historical_action as never }, { id: it.id, pick: best }, { id: "nope", pick: "go" }]);
  assert.deepEqual([t.calls, t.agreed, t.beat, t.agreedPct, t.beatPct], [2, 1, 1, 50, 50]);
});

test("hard mode calibration", () => {
  assert.equal(calibrationScore([{ confidence: 100, result: "right" }]), 100);
  assert.equal(calibrationScore([{ confidence: 100, result: "wrong" }]), 0);
  assert.equal(calibrationScore([{ confidence: 50, result: "wrong" }]), 75);
  assert.equal(calibrationScore([]), null);
});
