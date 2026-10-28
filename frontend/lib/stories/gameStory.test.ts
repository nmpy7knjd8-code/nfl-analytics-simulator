import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sentence, storyRows, type NarrRow } from "./narrator";
import { buildStory, gameIdFromQuery, playIdFromHash, playText, storyHref } from "./gameStory";

const detKc = JSON.parse(readFileSync(new URL("../__fixtures__/2023_01_DET_KC.json", import.meta.url), "utf8"));
const row: NarrRow = { play_id: 10, qtr: 4, clock: "1:05", posteam: "DET", down: 1, ydstogo: 10, text: "J.Goff pass to A.St. Brown for 20 yards, TOUCHDOWN.", play_type: "pass", home_wp: 0.6, home_wp_after: 0.2, swing: true, home_score: 20, away_score: 21 };

test("regulation sentence matches #58's template", () => {
  assert.equal(sentence(row, "KC", "DET"), "DET scored a touchdown with 1:05 left in the fourth quarter, a 40-point swing toward DET.");
});
test("overtime sentences never carry a win chance or swing size", () => {
  const kinds: Partial<NarrRow>[] = [{}, { text: "INTERCEPTED by X", play_type: "pass" }, { text: "FUMBLES, RECOVERED BY X", play_type: "run" },
    { play_type: "field_goal", text: "kick IS GOOD" }, { play_type: "field_goal", text: "No Good" }, { play_type: "punt", text: "punts" },
    { down: 4, text: "run for 2", play_type: "run" }, { text: "pass for 3", play_type: "pass" }];
  for (const k of kinds) {
    const s = sentence({ ...row, qtr: 5, ...k }, "KC", "DET");
    assert.ok(/overtime/.test(s), s);
    assert.ok(!/%|point|swing|win/i.test(s), s);
  }
});
test("story picks 3-5 rows in game order", () => {
  const s = buildStory(detKc);
  assert.ok(s.beats.length >= 3 && s.beats.length <= 5);
  const order = detKc.cols.play_id as number[];
  for (let i = 1; i < s.beats.length; i++) assert.ok(order.indexOf(s.beats[i - 1].playId) < order.indexOf(s.beats[i].playId));
  assert.equal(storyRows([row]).length, 1);
});
test("DET_KC play 1537 (Daily link target) resolves to a play on the story page", () => {
  const s = buildStory(detKc);
  const b = s.rows.get(1537);
  assert.ok(b, "play 1537 missing");
  assert.equal(b!.qtr, 2);
  assert.equal(storyHref("2023_01_DET_KC", 1537), "/story/?game=2023_01_DET_KC#play-1537");
  assert.equal(gameIdFromQuery("?game=2023_01_DET_KC"), "2023_01_DET_KC");
  assert.equal(gameIdFromQuery("?game=../x"), null);
  assert.equal(playIdFromHash("#play-1537"), 1537);
});
test("chart is regulation only; shown text has no ids or stat jargon", () => {
  const s = buildStory(detKc);
  assert.ok(s.points.every((p) => p.t >= 0 && p.t <= 3600));
  for (const b of s.beats) assert.ok(!/\b(EPA|WPA|xpass)\b|\d{1,2}-[A-Z]|play_id/.test(b.sentence + b.text), b.text);
  assert.equal(playText("(2:13) 3-J.Fox punts 40 yards, Center-47-S.Daly."), "J.Fox punts 40 yards, Center-S.Daly.");
});
