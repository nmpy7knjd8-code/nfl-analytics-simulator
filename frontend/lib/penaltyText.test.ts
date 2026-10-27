import { test } from "node:test";
import assert from "node:assert/strict";
import React, { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { GAME_PLAY_LISTS, gamePlays, playPenaltyText } from "./gamePlays";
import { expandGameV2, feedRowsFromGameV2, type FeedRow, type GameFileV2 } from "./gameFileV2";
import { PlayFeed } from "../components/PlayFeed";
import { SWING_EXPORT } from "./wpFixtures";
import { PlayPenalty } from "../components/PlayText";
import { OvertimePlayList, SwingPlayList } from "../components/WinProbabilityChart";

// tsx compiles .tsx with the classic runtime under "jsx": "preserve"; Next uses the automatic one.
(globalThis as { React?: typeof React }).React = React;

const esc = (t: string) => renderToStaticMarkup(h("i", null, t)).slice(3, -4);
const row = (desc: string, pen: string | null) =>
  renderToStaticMarkup(h("p", { className: "play-desc" }, desc, h(PlayPenalty, { text: pen })));

test("recheck-0015 P1-A: DET_KC Q3 12:50 play row renders its penalty sentence", () => {
  const raw = GAME_PLAY_LISTS["2023_01_DET_KC"].plays.find((p) => p.qtr === 3 && /12:50/.test(String(p.clock)))!;
  assert.ok(raw, "DET_KC Q3 12:50 row exists");
  const play = gamePlays("2023_01_DET_KC")!.find((p) => p.play_id === raw.play_id)!;
  const html = row(play.description!, playPenaltyText("2023_01_DET_KC", play.play_id));
  assert.match(html, /stopped for no gain/);
  assert.match(html, /<span class="play-penalty">[^<]*The down is replayed\.<\/span>/);
});

/** The game page's static play list (same fallback rows page.tsx builds), server-rendered. */
function feedHtml(gameId: string): string {
  const fallback: FeedRow[] = gamePlays(gameId)!.map((p) => ({
    id: p.play_id, quarter: p.quarter, clock_seconds: null, down: null, distance: null,
    text: p.description ?? "", penalty_text: playPenaltyText(gameId, p.play_id),
  }));
  return renderToStaticMarkup(h(PlayFeed, { gameId, fallback, swingRanks: [] }));
}

test("game page play list (PlayFeed) renders DET_KC Q3 12:50 with 'The down is replayed.'", () => {
  const raw = GAME_PLAY_LISTS["2023_01_DET_KC"].plays.find((p) => p.qtr === 3 && /12:50/.test(String(p.clock)))!;
  const html = feedHtml("2023_01_DET_KC");
  const li = html.slice(html.indexOf(`id="play-${raw.play_id}"`)).split("</li>")[0];
  assert.match(li, /stopped for no gain/);
  assert.match(li, /<span class="play-penalty">[^<]*The down is replayed\.<\/span>/);
});

test("game-file feed rows pair penalty_text with the fan text it came from", () => {
  const doc = {
    cols: { play_id: ["1", "2", "3"], qtr: [3, 3, 3], sec: [770, 700, 650], down: [1, 2, 3], ydstogo: [10, 10, 10],
      text: ["raw 1 PENALTY", "raw 2", "raw 3 PENALTY"], play_type: ["run", "run", "run"] },
  } as unknown as GameFileV2;
  const rows = feedRowsFromGameV2(doc, new Map([["1", "Fan 1."]]), new Map([["1", "The down is replayed."]]));
  assert.deepEqual(rows.map((r) => [r.text, r.penalty_text]), [["Fan 1.", "The down is replayed."], ["raw 2", null], ["raw 3 PENALTY", null]]);
  const v3 = { cols: { ...doc.cols, display_text: ["D1", "D2", "D3"], penalty_text: [null, null, "Flag, declined."] } } as unknown as GameFileV2;
  assert.equal(feedRowsFromGameV2(v3).at(-1)!.penalty_text, "Flag, declined.");
});

test("games-v3 display_text and penalty_text win over saved rows (QA N2: BUF_NYJ 1551)", () => {
  const doc = {
    cols: { play_id: [1551], qtr: [2], sec: [197], down: [1], ydstogo: [10], play_type: ["pass"],
      text: ["(3:17) 2-Z.Wilson pass ... INTERCEPTED by 58-M.Milano ... PENALTY on BUF-58-M.Milano, Taunting, 15 yards"],
      display_text: ["Matt Milano intercepts Zach Wilson and returns it 13 yards."],
      penalty_text: ["Penalty on Matt Milano (BUF): taunting, 15 yards against BUF."] },
  } as unknown as GameFileV2;
  // Saved row without the penalty (pre-#106 shape) must not hide the file's penalty sentence.
  const [row] = feedRowsFromGameV2(doc, new Map([["1551", "Old fan text."]]), new Map([["1551", null]]));
  assert.equal(row.text, "Matt Milano intercepts Zach Wilson and returns it 13 yards.");
  assert.equal(row.penalty_text, "Penalty on Matt Milano (BUF): taunting, 15 yards against BUF.");
});

test("every plays-file row with penalty_text renders it", () => {
  let n = 0;
  const feeds = Object.fromEntries(Object.keys(GAME_PLAY_LISTS).map((id) => [id, feedHtml(id)]));
  for (const [id, list] of Object.entries(GAME_PLAY_LISTS)) {
    for (const p of list.plays) {
      if (!p.penalty_text) continue;
      n++;
      assert.ok(feeds[id].includes(esc(p.penalty_text.trim())), `${id} ${p.play_id}`);
    }
  }
  assert.ok(n >= 9, `expected the 9 audited rows, got ${n}`);
});

test("no penalty span when penalty_text is null", () => {
  assert.equal(row("x", null), '<p class="play-desc">x</p>');
});

test("swing cards render penalty_text (BUF_NYJ Milano taunting)", () => {
  const g = SWING_EXPORT.games["2023_01_BUF_NYJ"] as unknown as { chart: { play_id: string; penalty_text: string | null }[] };
  const r = g.chart.find((x) => x.play_id === "1551" || String(x.play_id) === "1551")!;
  const point = { play_id: r.play_id, quarter: 2, game_seconds_elapsed: 0, display_text: "Milano intercepts.", penalty_text: r.penalty_text } as never;
  const html = renderToStaticMarkup(
    h(SwingPlayList, { swings: [{ point, why: "w", delta: 0.2 } as never], series: { home_team_id: "NYJ", away_team_id: "BUF", points: [] } as never }),
  );
  assert.match(html, /15 yards against BUF/);
});

test("Overtime card renders penalty_text", () => {
  const html = renderToStaticMarkup(
    h(OvertimePlayList, { plays: [{ play_id: "1", quarter: 5, display_text: "A run.", penalty_text: "Flag on X, declined." } as never] }),
  );
  assert.match(html, /A run\.<span class="play-penalty">Flag on X, declined\.<\/span>/);
});

test("game-file path (games-v2/v3 cols) carries penalty_text", () => {
  const doc = {
    cols: { play_id: ["1", "2"], qtr: [3, 3], sec: [770, 700], posteam: ["DET", "DET"], down: [1, 2], ydstogo: [10, 10], yardline_100: [50, 50],
      text: ["a", "b"], display_text: ["A", "B"], penalty_text: ["The down is replayed.", null], play_type: ["run", "run"],
      home_wp: [0.5, 0.5], home_score: [0, 0], away_score: [0, 0] },
    fourth: {}, swing_play_ids: [], final_home_wp: 0.5, engine_version: "t",
  } as unknown as GameFileV2;
  const plays = expandGameV2(doc).plays;
  assert.equal(plays[0].penalty_text, "The down is replayed.");
  assert.equal(plays[1].penalty_text, null);
});
