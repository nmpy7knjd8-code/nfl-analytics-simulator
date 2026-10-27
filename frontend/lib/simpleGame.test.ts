import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_ITEMS, scoreCall, dailySet } from "./daily";
import { flagText, kickTooFar, optionTags, plainShare, spotText, tappable, bestCallText, outcomeFromGame } from "./simpleGame";
import type { GameFileV2 } from "./gameFileV2";

const byId = (id: string) => DAILY_ITEMS.find((i) => i.id === id)!;

test("flag and spot text", () => {
  assert.equal(flagText(byId("2022_18_NYG_PHI-3310")), "4th & 1 · MIDFIELD");
  assert.equal(flagText(byId("2023_01_DET_KC-1986")), "4th & 10 · OWN 42");
  assert.equal(flagText(byId("2022_03_BAL_NE-819")), "4th & 6 · BAL 16");
  assert.equal(flagText(byId("2023_09_TB_HOU-3638")), "4th & Goal · TB 11");
  assert.equal(spotText(byId("2022_03_BAL_NE-819")), "BAL 16");
});

test("no Kick button past 64 yd, distance shown otherwise, no punt inside the 35", () => {
  for (const it of DAILY_ITEMS) {
    const ids = tappable(it).map((o) => o.id);
    const fg = it.situation.yardline_100 + 18;
    if (fg > 64) assert.ok(!ids.includes("fg"), it.id);
    const k = tappable(it).find((o) => o.id === "fg");
    if (k) assert.equal(k.detail, `${Math.round(fg)} yd`);
    assert.equal(kickTooFar(it), !ids.includes("fg"));
    if (it.situation.yardline_100 < 35) assert.ok(!ids.includes("punt"), it.id);
  }
});

test("tags: only offered options (N9); every tie is Best; ½ only for near, non-tied options", () => {
  for (const it of DAILY_ITEMS) {
    const offered = tappable(it).map((o) => o.id);
    for (const pick of offered) {
      const s = scoreCall(pick, it);
      const tags = optionTags(it, s);
      assert.deepEqual(tags.map((t) => t.id).sort(), [...offered].filter((c) => it.reveal.values[c] != null).sort(), it.id);
      const mine = tags.find((t) => t.id === pick)!;
      if (s.result === "right") assert.equal(mine.tag, "Best", it.id);
      if (s.result === "close") assert.equal(mine.tag, "Close call · ½ point", it.id);
      if (s.result === "wrong") assert.equal(mine.tag, null, it.id);
      assert.ok(tags.some((t) => t.tag === "Best"));
      assert.ok(!/\d/.test(bestCallText(tags)), "no numbers in the best-call line");
    }
  }
  // CAR 4th & 4 at NO 38: Go and Kick both show 91.9%, so both are Best and Go scores full credit.
  const car = byId("2022_03_NO_CAR-2560");
  assert.equal(scoreCall("go", car).result, "right");
  assert.deepEqual(optionTags(car, scoreCall("go", car)).filter((t) => t.tag === "Best").map((t) => t.id).sort(), ["fg", "go"]);
  // NE at BAL 16: FG 40.6% vs Go 40.7% is close but not tied → ½.
  assert.equal(scoreCall("fg", byId("2022_03_BAL_NE-819")).result, "close");
});

test("share text has no colored emoji and no teams", () => {
  const t = plainShare(299, ["right", "close", "wrong"], "1.5", 6);
  assert.equal(t, "Fourth & Daily #299 · 1.5/3 · streak 6\n✓ ½ ✕");
  assert.ok(!/\p{Extended_Pictographic}/u.test(t.replace(/[✓✕]/g, "")));
});

test("outcome from the game file: ball end spot and plain text only", () => {
  const doc = {
    schema_version: "game.v2", game: { id: "g", home: "PHI", away: "NYG", home_score: 22, away_score: 16 },
    cols: {
      play_id: [3310, 3321, 3341], qtr: [4, 4, 4], sec: [817, 790, 773], posteam: ["NYG", "NYG", "NYG"], down: [4, null, 1], ydstogo: [1, 0, 10],
      yardline_100: [50, 49, 49], text: ["(13:37) raw desc", "Timeout #1 by PHI", "x"], play_type: ["pass", "no_play", "pass"],
      home_wp: [0, 0, 0], home_score: [19, 19, 19], away_score: [3, 3, 3], display_text: ["Davis Webb completes a pass to Lawrence Cager for 1 yard.", "", ""],
    },
  } as unknown as GameFileV2;
  const o = outcomeFromGame(doc, byId("2022_18_NYG_PHI-3310"), (a) => ({ PHI: "Eagles", NYG: "Giants" })[a] ?? a)!;
  assert.equal(o.endYardline100, 49);
  assert.equal(o.text, "Davis Webb completes a pass to Lawrence Cager for 1 yard.");
  assert.equal(o.finalText, "The Eagles won 22–16.");
  assert.ok(dailySet("2026-10-27").length === 5);
});
