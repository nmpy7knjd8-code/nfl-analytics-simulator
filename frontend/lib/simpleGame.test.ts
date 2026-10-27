import { test } from "node:test";
import assert from "node:assert/strict";
// Frozen copy of 2022_03_NO_CAR-2560 with the tie it had when these tests were written;
// model rebuilds may move its live values, but the tie-scoring rules need a real tie.
import tieItemJson from "./tieItem.fixture.json";
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
  const car = (tieItemJson as unknown as (typeof DAILY_ITEMS)[number]);
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

/** Minimal game file: the 4th-down row, then the next snap. */
function twoRow(it: ReturnType<typeof byId>, row: { text: string; display: string; type: string; penalty?: string | null }, next: { pos: string; yl: number; down: number }) {
  const pid = Number(it.id.split("-").pop());
  const s = it.situation;
  return {
    schema_version: "game.v2", game: { id: "g", home: s.home_team ?? s.defteam, away: s.posteam },
    cols: {
      play_id: [pid, pid + 20], qtr: [4, 4], sec: [600, 590], posteam: [s.posteam, next.pos], down: [4, next.down], ydstogo: [s.distance, 10],
      yardline_100: [s.yardline_100, next.yl], text: [row.text, "x"], play_type: [row.type, "pass"], home_wp: [0, 0],
      home_score: [0, 0], away_score: [0, 0], display_text: [row.display, ""], penalty_text: [row.penalty ?? null, null],
    },
  } as unknown as GameFileV2;
}

test("QA 0116 SG1: an interception or lost fumble on 4th down is not 'Turnover on downs'", () => {
  const it = byId("2022_18_NYG_PHI-3310");
  const nk = (a: string) => a;
  const pick = outcomeFromGame(twoRow(it, { text: "(13:37) D.Webb pass short left INTERCEPTED by D.Elliott at PHI 40.", display: "Pass intercepted.", type: "pass" }, { pos: "PHI", yl: 60, down: 1 }), it, nk)!;
  assert.equal(pick.label, "Intercepted");
  const fum = outcomeFromGame(twoRow(it, { text: "(13:37) S.Barkley up the middle to PHI 48. S.Barkley FUMBLES, RECOVERED by PHI-J.Doe at PHI 48.", display: "Fumble.", type: "run" }, { pos: "PHI", yl: 52, down: 1 }), it, nk)!;
  assert.equal(fum.label, "Fumble lost");
  const kept = outcomeFromGame(twoRow(it, { text: "(13:37) S.Barkley FUMBLES, RECOVERED by NYG-S.Barkley at 50.", display: "Short.", type: "run" }, { pos: "PHI", yl: 50, down: 1 }), it, nk)!;
  assert.equal(kept.label, "Turnover on downs");
});

test("QA 0116 SG2: a blocked punt says so, with no 'punts 0 yards', and ends at the recovery spot", () => {
  const it = DAILY_ITEMS.find((i) => /-\d+$/.test(i.id) && i.situation.yardline_100 >= 40)!;
  const s = it.situation;
  const o = outcomeFromGame(twoRow(it, { text: "(2:00) M.Haack punt is BLOCKED by J.Doe, Center-L.Rhodes, RECOVERED by X at Y.", display: "Matt Haack punts 0 yards.", type: "punt" }, { pos: s.defteam, yl: 98, down: 1 }), it, (a) => a)!;
  assert.equal(o.label, "Punt blocked");
  assert.ok(!/punts 0 yards/.test(o.text ?? ""), o.text ?? "");
  assert.equal(o.endYardline100, 2);
});

test("QA 0116 SG3: penalty_text rides along with the outcome", () => {
  const it = byId("2022_18_NYG_PHI-3310");
  const o = outcomeFromGame(twoRow(it, { text: "x", display: "Run for 2 yards.", type: "run", penalty: "Holding on PHI, declined." }, { pos: "NYG", yl: 48, down: 1 }), it, (a) => a)!;
  assert.equal(o.penalty, "Holding on PHI, declined.");
});

test("QA 0116 SG5: three tied options say 'All three count.'", () => {
  assert.match(bestCallText([{ id: "go", tag: "Best" }, { id: "fg", tag: "Best" }, { id: "punt", tag: "Best" }]), /All three count\.$/);
  assert.match(bestCallText([{ id: "go", tag: "Best" }, { id: "punt", tag: "Best" }]), /Both count\.$/);
});
