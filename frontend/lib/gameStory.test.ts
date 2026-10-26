import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { elapsed, grade, leadChanges, narrator, numberedSwings, playIdFromItemId, quarters, STORY_GAME_IDS, storyHref, winner, wpLabel, type GameFile } from "./gameStory";
import { DAILY_ITEMS } from "./daily";

const load = (id: string) => JSON.parse(readFileSync(new URL(`../public/data/games/${id}.json`, import.meta.url), "utf8")) as GameFile;

// Facts checked against #44's gameFacts.json (nflverse schedules).
const FACTS: Record<string, { home: string; away: string; hs: number; as: number; ot: boolean; date: string; week: number; stadium: string }> = {
  "2023_01_DET_KC": { home: "KC", away: "DET", hs: 20, as: 21, ot: false, date: "2023-09-07", week: 1, stadium: "GEHA Field at Arrowhead Stadium" },
  "2023_01_BUF_NYJ": { home: "NYJ", away: "BUF", hs: 22, as: 16, ot: true, date: "2023-09-11", week: 1, stadium: "MetLife Stadium" },
  "2023_03_PHI_TB": { home: "TB", away: "PHI", hs: 11, as: 25, ot: false, date: "2023-09-25", week: 3, stadium: "Raymond James Stadium" },
};

test("each story game matches nflverse facts: score, winner, date, week, stadium, final WP, last running score", () => {
  for (const id of STORY_GAME_IDS) {
    const f = load(id);
    const x = FACTS[id];
    assert.equal(f.schema_version, "game.v1");
    assert.equal(f.provenance.source, "nflverse");
    assert.ok(f.provenance.nflreadpy_version && f.provenance.data_sha256 && f.provenance.build_date);
    assert.deepEqual([f.game.home, f.game.away, f.game.home_score, f.game.away_score, f.game.overtime, f.game.date, f.game.week, f.game.stadium], [x.home, x.away, x.hs, x.as, x.ot, x.date, x.week, x.stadium], id);
    assert.equal(winner(f.game), x.hs > x.as ? x.home : x.away);
    assert.equal(f.final_home_wp, x.hs > x.as ? 1 : 0);
    const last = f.plays[f.plays.length - 1];
    assert.deepEqual([last.home_score, last.away_score], [x.hs, x.as], id);
    assert.equal(quarters(f).some((q) => q.qtr === 5), x.ot, id);
  }
});

test("swing plays: up to 5, numbered in game order, all flagged in the file", () => {
  for (const id of STORY_GAME_IDS) {
    const f = load(id);
    const s = numberedSwings(f);
    assert.ok(s.length > 0 && s.length <= 5);
    assert.deepEqual(s.map((x) => x.n), s.map((_, i) => i + 1));
    for (const x of s) assert.ok(f.swing_play_ids.includes(x.play.play_id));
    for (let i = 1; i < s.length; i++) assert.ok(elapsed(s[i].play) >= elapsed(s[i - 1].play));
  }
});

test("narrator: 3–5 sentences, first one states the real result", () => {
  const det = narrator(load("2023_01_DET_KC"));
  assert.ok(det.length >= 3 && det.length <= 5);
  assert.equal(det[0], "DET beat KC 21–20 at GEHA Field at Arrowhead Stadium.");
  assert.equal(narrator(load("2023_01_BUF_NYJ"))[0], "NYJ beat BUF 22–16 in overtime at MetLife Stadium.");
  for (const id of STORY_GAME_IDS) for (const s of narrator(load(id))) assert.doesNotMatch(s, /undefined|NaN/);
});

test("every % names its team", () => {
  assert.equal(wpLabel(0.58, "KC", "DET"), "KC 58%");
  assert.equal(wpLabel(0.42, "KC", "DET"), "DET 58%");
  assert.equal(wpLabel(0.5, "KC", "DET"), "KC 50%");
});

test("4th-down mini grade follows the engine record", () => {
  const f = load("2023_01_DET_KC");
  const p = f.plays.find((x) => x.play_id === 1986)!.fourth_down!;
  assert.deepEqual(grade(p), { label: "Model: Punt (−5.5 pts)", tone: "miss" });
  assert.ok(leadChanges(f) >= 1);
});

test("See this game at this play: only for games with a story page, and the play exists there", () => {
  const linked = DAILY_ITEMS.filter((i) => storyHref(i.source.game_id, playIdFromItemId(i.id)));
  assert.deepEqual(linked.map((i) => i.id), ["2023_01_DET_KC-1986"]);
  for (const i of linked) {
    const f = load(i.source.game_id!);
    assert.ok(f.plays.some((p) => p.play_id === playIdFromItemId(i.id)));
  }
  assert.equal(storyHref("2022_01_LV_LAC", 10), null);
  assert.equal(storyHref("2023_01_DET_KC", 1986), "/games/2023_01_DET_KC/#play-1986");
});
