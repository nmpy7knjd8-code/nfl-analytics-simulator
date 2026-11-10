import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { GameFileV2 } from "./gameFileV2";
import { NO_FILTER, bigPlayGain, buildFeed, gameWeekLabel, canChart, chartPoints, elapsed, filterFeed, metaLine, swingText, toggle, winLine } from "./playFeed";

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

test("overtime (real game, BUF @ NYJ 2023): plays listed, no win chance, no chart", () => {
  const doc = JSON.parse(readFileSync(new URL("./__fixtures__/2023_01_BUF_NYJ.json", import.meta.url), "utf8")) as GameFileV2;
  const ot = buildFeed(doc);
  const otRows = ot.plays.filter((p) => p.ot);
  assert.ok(otRows.length > 0 && otRows.every((p) => p.qtr > 4 && !canChart(p) && !p.big));
  assert.ok(otRows.every((p) => p.homeWp == null && p.homeWpBefore == null), "OT rows stay null even if the file still has values");
  assert.ok(ot.plays.filter((p) => !p.ot).every(canChart));
  assert.deepEqual(filterFeed(ot.plays, { ...NO_FILTER, qtr: 5 }).map((p) => p.id), otRows.map((p) => p.id));
  const pts = chartPoints(ot.plays);
  const reg = ot.plays.filter((p) => !p.ot);
  assert.equal(pts.length, reg.filter((p) => p.homeWp != null).length + (reg[0]?.homeWpBefore != null ? 1 : 0));
  assert.ok(pts.every((p) => p.t <= 3600 && p.wp != null && Number.isFinite(p.wp)));
  assert.ok(!pts.some((p) => otRows.some((o) => o.id === p.id)));
  // Line ends at the last regulation value (0.496 at end of Q4), not at the OT result (NYJ won, 1.0).
  assert.notEqual(pts.at(-1)!.wp, doc.final_home_wp);
  assert.equal(pts.at(-1)!.wp, 0.496);
  assert.match(metaLine(otRows[0]), /^OT · /);
  assert.ok(otRows.at(-1)!.scoring); // walk-off punt return
  assert.deepEqual(otRows.filter((p) => p.scoring).length, 1);
  assert.ok(ot.plays.filter((p) => p.scoring).every((p) => /field goal|touchdown|extra point|safety|two-point|kicks the extra|\\bgood\\b/i.test(p.text)), 'scoring tag sits on the scoring play');
});

test("chart skips null rows: no placeholder, no result fallback, no line through OT (games-v7.1 shape)", () => {
  const doc = JSON.parse(readFileSync(new URL("./__fixtures__/2023_01_BUF_NYJ.json", import.meta.url), "utf8")) as GameFileV2;
  // games-v7.1: every OT home_wp is null, including END GAME. Also drop the last regulation
  // non-play value so the last real play's after-value is null — the chart must not invent one.
  for (let i = 0; i < doc.cols.play_id.length; i++) {
    if (doc.cols.qtr[i] > 4) (doc.cols.home_wp as (number | null)[])[i] = null;
  }
  const endQ4 = doc.cols.text.findIndex((t, i) => doc.cols.qtr[i] === 4 && /^END (QUARTER 4|Q4)/i.test(t ?? ""));
  assert.ok(endQ4 >= 0);
  const endQ4Wp = doc.cols.home_wp[endQ4];
  (doc.cols.home_wp as (number | null)[])[endQ4] = null;
  const ot = buildFeed(doc);
  const lastReg = ot.plays.filter((p) => !p.ot).at(-1)!;
  assert.equal(lastReg.homeWp, null, "no fallback to the game result when the after-value is null");
  assert.notEqual(endQ4Wp, null);
  const pts = chartPoints(ot.plays);
  assert.ok(pts.every((p) => p.wp != null && p.t <= 3600));
  assert.ok(!pts.some((p) => p.id === lastReg.id), "null after-value is skipped, not drawn as a placeholder");
  assert.notEqual(pts.at(-1)!.wp, 1, "does not draw the OT result");
  assert.notEqual(pts.at(-1)!.wp, doc.final_home_wp);
  assert.equal(pts.at(-1)!.wp, lastReg.homeWpBefore);
  assert.ok(ot.plays.filter((p) => p.ot).every((p) => p.homeWp == null && p.homeWpBefore == null));
  assert.equal(swingText(ot, lastReg), "");
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

test("header names the week, or the playoff round", () => {
  assert.equal(g.label, "Week 1, 2023");
  assert.equal(gameWeekLabel(2023, 18, "REG"), "Week 18, 2023");
  assert.deepEqual([19, 20, 21, 22].map((w) => gameWeekLabel(2023, w, "POST")), ["Wild Card, 2023", "Divisional, 2023", "Conference, 2023", "Super Bowl, 2023"]);
  assert.deepEqual([18, 21].map((w) => gameWeekLabel(2020, w, "POST")), ["Wild Card, 2020", "Super Bowl, 2020"]);
});

test("swing line says it is the win chance, in %, for the team ahead", () => {
  const bn = buildFeed(JSON.parse(readFileSync(new URL("./__fixtures__/2023_01_BUF_NYJ.json", import.meta.url), "utf8")) as GameFileV2);
  const fg = bn.plays.find((p) => p.qtr === 1 && p.sec === 189 && /Bass.s 40-yard field goal is good/i.test(p.text))!;
  // Pre-snap home (NYJ) chance 49.9% -> 51.1% at the next snap (NYJ receive the kickoff), per the model.
  assert.ok(fg.homeWp != null);
  assert.equal(winLine(bn, fg.homeWp).team, "NYJ");
  assert.equal(swingText(bn, fg), "NYJ's win chance up 1%");
  const prev = bn.plays[bn.plays.indexOf(fg) - 1];
  assert.equal(swingText(bn, prev), "NYJ's win chance down 2%");
  const flat = bn.plays.find((p) => p.homeWp != null && p.homeWpBefore != null && Math.round(p.homeWp * 100) === Math.round(p.homeWpBefore * 100))!;
  assert.equal(swingText(bn, flat), "No change");
  for (const p of bn.plays.filter((p) => p.homeWp != null)) assert.match(swingText(bn, p), /^(No change|[A-Z]{2,3}'s win chance (up|down) \d+%)$/);
  assert.ok(bn.plays.some((p) => p.ot && swingText(bn, p) === ""));
});

test("swing wording is percent from the shown rounded numbers, never pts", () => {
  const p = g.plays.find((x) => Math.abs(Math.round(x.homeWp * 100) - Math.round(x.homeWpBefore * 100)) >= 10)!;
  assert.match(swingText(g, p), /^(DET|KC)'s win chance (up|down) \d{2,}%$/);
  for (const x of g.plays) {
    assert.doesNotMatch(swingText(g, x), /\bpts?\b/);
    const d = Math.abs(Math.round(x.homeWp * 100) - Math.round(x.homeWpBefore * 100));
    if (d) assert.ok(swingText(g, x).endsWith(` ${d}%`));
  }
});

test("last real play ends at the final result, never at the END GAME fallback row", () => {
  const last = g.plays.at(-1)!;
  assert.match(last.text, /Goff kneels/);
  assert.ok(g.plays.every((p) => !/^END GAME/.test(p.text)));
  assert.equal(last.homeWp, 0); // DET won 21-20
  assert.equal(swingText(g, last), swingText(g, { ...last, homeWp: 0 }));
  assert.match(swingText(g, last), /^DET's win chance up \d+/);
  const cw = buildFeed(JSON.parse(readFileSync(new URL("./__fixtures__/2024_08_CHI_WAS.json", import.meta.url), "utf8")) as GameFileV2);
  const hail = cw.plays.at(-1)!;
  assert.match(hail.text, /Daniels/);
  assert.equal(hail.homeWp, 1); // WAS won 18-15 on the last play; END GAME row says 0.886
  assert.match(swingText(cw, hail), /^WAS's win chance up \d+/);
});

test("Big play tag agrees with the computed swing (stale swing_play_ids)", () => {
  // Live games-v3 file: the final Goff kneel goes DET 96% -> 100% (home KC 0.042 -> 0), but swing_play_ids still lists it.
  const live = structuredClone(doc);
  const g0 = buildFeed(live);
  const kneel = g0.plays[g0.plays.length - 1];
  assert.match(kneel.text, /kneel/i);
  const row = live.cols.play_id.findIndex((id) => String(id) === kneel.id);
  (live.cols.home_wp as (number | null)[])[row] = 0.042;
  assert.ok(live.swing_play_ids.map(String).includes(kneel.id), "stale list still names the kneel");
  const g = buildFeed(live);
  const last = g.plays[g.plays.length - 1];
  assert.equal(Math.round(Math.abs(last.homeWp - last.homeWpBefore) * 100), 4);
  assert.equal(last.big, false);
  // Real big swings stay tagged, and every tag meets the threshold in regulation.
  const bigs = g.plays.filter((p) => p.big);
  assert.ok(bigs.length > 0);
  for (const p of bigs) assert.ok(Math.abs(p.homeWp - p.homeWpBefore) >= 0.08 && !p.ot);
});

test("Overtime rows never get the Big play tag", () => {
  const cw = buildFeed(JSON.parse(readFileSync(new URL("./__fixtures__/2024_08_CHI_WAS.json", import.meta.url), "utf8")) as GameFileV2);
  const td = cw.plays[cw.plays.length - 1];
  assert.equal(td.big, true, "Daniels' game-winning TD (+90 pts) is still a big play");
  assert.ok(buildFeed(doc).plays.concat(cw.plays).filter((p) => p.ot).every((p) => !p.big));
});

test("S7: Big-play cards show the gaining team's +X% win chance from the shown numbers", () => {
  const big = g.plays.filter((p) => p.big);
  assert.ok(big.length > 0);
  for (const p of big) {
    const d = Math.round(p.homeWp * 100) - Math.round(p.homeWpBefore * 100);
    assert.equal(bigPlayGain(g, p), `${d >= 0 ? g.home : g.away} +${Math.abs(d)}% win chance`);
    assert.ok(!p.ot);
    assert.doesNotMatch(bigPlayGain(g, p), /pts?\b|EPA|WPA/);
  }
});
