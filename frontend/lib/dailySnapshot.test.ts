import { test } from "node:test";
import assert from "node:assert/strict";
import snapshot from "./dailySnapshot.json";
import schedule from "./dailySchedule.json";
import { DAILY_ITEMS, bestCalls, dailySet, dateKey, practiceSet, scoreCall } from "./daily";
import { bestCallText, optionTags } from "./simpleGame";

type Entry = { recommendation: string; values: Record<string, number>; best: string[] };
const SNAP = (snapshot as unknown as { days: Record<string, Record<string, Entry>> }).days;
const DAYS = (schedule as { days: Record<string, string[]> }).days;

/** Published values (pre-#122 pack, ab2bc80). Hard-coded: never change these. */
const PUBLISHED: Record<string, Record<string, [Record<string, number>, string[]]>> = {
  "2026-10-26": {
    "2022_13_DEN_BAL-2272": [{ go: 0.588102, punt: 0.561169 }, ["go"]],
    "2023_17_MIA_BAL-1579": [{ go: 0.283885, punt: 0.256203, fg: 0.238393 }, ["go"]],
    "2022_12_NE_MIN-625": [{ go: 0.509156, punt: 0.534686 }, ["punt"]],
    "2022_06_SF_ATL-3503": [{ go: 0.998227, punt: 0.998134 }, ["go", "punt"]],
    "2023_06_DET_TB-2394": [{ go: 0.225789, punt: 0.18286, fg: 0.25451 }, ["fg"]],
  },
  "2026-10-27": {
    "2022_18_NYG_PHI-3310": [{ go: 0.0279705, punt: 0.0167704 }, ["go"]],
    "2022_03_BAL_NE-819": [{ go: 0.406666, punt: 0.341117, fg: 0.406086 }, ["go"]],
    "2023_01_DET_KC-1986": [{ go: 0.179335, punt: 0.147245 }, ["go"]],
    "2022_03_NO_CAR-2560": [{ go: 0.918667, punt: 0.908265, fg: 0.919462 }, ["fg", "go"]],
    "2023_09_TB_HOU-3638": [{ go: 0.537563, punt: 0.442742, fg: 0.618018 }, ["fg"]],
  },
};

test("published days keep their snapshot values and best call (Oct 26, Oct 27 pre-#122)", () => {
  for (const [d, want] of Object.entries(PUBLISHED)) {
    assert.deepEqual(Object.keys(SNAP[d]).sort(), Object.keys(want).sort(), `${d} ids`);
    for (const [id, [values, best]] of Object.entries(want)) {
      assert.deepEqual(SNAP[d][id].values, values, `${d} ${id} values changed`);
      assert.deepEqual(SNAP[d][id].best, best, `${d} ${id} best call changed`);
    }
  }
});

test("today has a snapshot (run scripts/snapshot-daily.ts and commit)", () => {
  const today = dateKey();
  assert.ok(SNAP[today], `dailySnapshot.json has no entry for today (${today})`);
});

test("every snapshot day matches its schedule, best matches its values, and no future day is frozen", () => {
  const today = dateKey();
  for (const [d, day] of Object.entries(SNAP)) {
    assert.ok(d <= today, `${d} is in the future; snapshot only published days`);
    assert.deepEqual(Object.keys(day), DAYS[d], `${d} ids differ from dailySchedule.json`);
    for (const [id, e] of Object.entries(day)) {
      const live = DAILY_ITEMS.find((i) => i.id === id)!;
      assert.deepEqual(bestCalls({ ...live, reveal: { recommendation: e.recommendation, values: e.values } }), e.best, `${d} ${id}`);
    }
  }
});

test("daily game reads the snapshot: Oct 27 play 4 FG and Go (both 91.9%) are still Right", () => {
  const set = dailySet("2026-10-27");
  for (const it of set) assert.deepEqual(it.reveal.values, PUBLISHED["2026-10-27"][it.id][0]);
  const p4 = set[3];
  assert.equal(p4.id, "2022_03_NO_CAR-2560");
  assert.equal(scoreCall("fg", p4).result, "right");
  assert.equal(scoreCall("go", p4).result, "right");
  assert.equal(scoreCall("punt", p4).result, "close");
});

test("practice keeps live pack values", () => {
  const live = new Map(DAILY_ITEMS.map((i) => [i.id, i]));
  for (const it of practiceSet("x")) assert.equal(it, live.get(it.id));
});

test("P3: best-call sentence matches verb to count", () => {
  const t = (best: string[], close: string[]) =>
    bestCallText([...best.map((id) => ({ id, tag: "Best" })), ...close.map((id) => ({ id, tag: "Close call · ½ point" }))] as Parameters<typeof bestCallText>[0]);
  assert.equal(t(["go"], ["fg", "punt"]), "Going for it was the best call, and kicking the field goal and punting were close behind.");
  assert.equal(t(["go"], ["punt"]), "Going for it was the best call, and punting was close behind.");
  assert.equal(t(["fg"], []), "Kicking the field goal was the best call.");
  assert.equal(t(["go", "fg", "punt"], []), "Going for it, kicking the field goal and punting were equally good. All three count.");
  const p4 = dailySet("2026-10-27")[3];
  assert.equal(bestCallText(optionTags(p4, scoreCall("fg", p4))), "Kicking the field goal and going for it were equally good. Both count.");
});
