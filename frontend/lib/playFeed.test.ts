import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GameFileV2 } from "./gameFileV2";
import { NO_FILTER, buildFeed, chartPoints, elapsed, filterFeed, metaLine, swingText, toggle, winLine } from "./playFeed";

const doc = JSON.parse(readFileSync(new URL("./__fixtures__/2023_01_DET_KC.json", import.meta.url), "utf8")) as GameFileV2;
const g = buildFeed(doc);

test("feed keeps real plays only, in game order, with win chance in range", () => {
  assert.equal(g.home, "KC");
  assert.ok(g.plays.length > 100);
  assert.ok(g.plays.every((p) => !/^(GAME|END )/.test(p.text) && p.homeWp >= 0 && p.homeWp <= 1));
  for (let i = 1; i < g.plays.length; i++) assert.ok(g.plays[i].t >= g.plays[i - 1].t);
  assert.equal(g.plays.at(-1)!.homeWp, 0); // KC lost
});

test("filters: team, quarter, big plays, 4th downs, scoring, and they combine", () => {
  assert.ok(filterFeed(g.plays, { ...NO_FILTER, team: "DET" }).every((p) => p.team === "DET"));
  assert.ok(filterFeed(g.plays, { ...NO_FILTER, qtr: 3 }).every((p) => p.qtr === 3));
  const big = filterFeed(g.plays, { ...NO_FILTER, kind: "big" });
  assert.deepEqual(new Set(big.map((p) => Number(p.id))), new Set(doc.swing_play_ids.filter((id) => g.plays.some((p) => p.id === String(id)))));
  assert.ok(filterFeed(g.plays, { ...NO_FILTER, kind: "fourth" }).every((p) => p.down === 4));
  const scoring = filterFeed(g.plays, { ...NO_FILTER, kind: "scoring" });
  assert.ok(scoring.length >= 6);
  assert.equal(scoring.at(-1)!.homeScore + scoring.at(-1)!.awayScore, 41);
  const both = filterFeed(g.plays, { team: "KC", qtr: 4, kind: "scoring" });
  assert.ok(both.every((p) => p.team === "KC" && p.qtr === 4 && p.scoring));
  assert.deepEqual(filterFeed(g.plays, { team: "KC", qtr: 1, kind: "fourth" }).filter((p) => p.team !== "KC"), []);
});

test("toggle swaps within a group and clears on a second tap", () => {
  const a = toggle(NO_FILTER, "qtr", 2);
  assert.equal(a.qtr, 2);
  assert.equal(toggle(a, "qtr", 3).qtr, 3);
  assert.equal(toggle(a, "qtr", 2).qtr, null);
});

test("plain words, no jargon", () => {
  const p = g.plays.find((x) => x.down === 4)!;
  assert.match(metaLine(p), /^Q\d · \d+:\d\d · 4th & \d+ · [A-Z]+ ball$/);
  assert.deepEqual(winLine(g, 0.38), { team: "DET", pct: 62 });
  for (const x of g.plays) assert.doesNotMatch(swingText(g, x) + metaLine(x), /EPA|WPA|expected points|probability/i);
});

test("chart starts at kickoff and has one point per play", () => {
  const pts = chartPoints(g.plays);
  assert.equal(pts.length, g.plays.length + 1);
  assert.equal(pts[0].t, 0);
  assert.equal(elapsed(4, 0), 3600);
});

test("scoring tag sits on the play that scores (row scores are post-play)", () => {
  const fgs = g.plays.filter((p) => /Butker \d+ yard field goal is GOOD/.test(p.text));
  assert.equal(fgs.length, 2);
  for (const fg of fgs) {
    const k = g.plays.indexOf(fg);
    assert.ok(fg.scoring, `FG ${fg.id} tagged`);
    assert.equal(g.plays[k - 1].scoring, false, `play before FG ${fg.id} not tagged`);
    assert.equal(fg.homeScore - g.plays[k - 1].homeScore, 3);
  }
  const bell = g.plays.find((p) => /Mahomes pass short right to 81-B\.Bell .*TOUCHDOWN/.test(p.text))!;
  assert.ok(bell.scoring);
  assert.deepEqual([bell.homeScore, bell.awayScore], [13, 7]);
  // The KC timeout right after the Bell TD carries no score change and is never a scoring row.
  const c = doc.cols;
  const r = c.play_id.findIndex((id) => String(id) === bell.id);
  assert.match(c.text[r + 1] ?? "", /^Timeout #3 by KC/);
  const timeout = g.plays.find((p) => p.id === String(c.play_id[r + 1]));
  assert.ok(!timeout || !timeout.scoring);
  assert.ok(g.plays[g.plays.indexOf(bell) + 1].scoring); // the extra point after the timeout
});
