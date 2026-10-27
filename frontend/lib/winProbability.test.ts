import { test } from "node:test";
import assert from "node:assert/strict";
import { yardArticle, clockLabel, findSwingPlays, isSwing, whyText, DEFAULT_SWING_WP_THRESHOLD } from "./winProbability";
import { fixturePlays, fixtureGame, FIXTURE_GAMES } from "./fixtures";
import { GAME_PLAY_LISTS } from "./gamePlays";
import { openingWinChance } from "./wpFixtures";
import { situationLine, inGameOrder, swingMeta, type EventPoint } from "./winProbability";
import { SWING_EXPORT, WP_FIXTURES } from "./wpFixtures";

test("fixtures follow the contract: home, pre-snap, post = next pre, final = result", () => {
  for (const { series, origin, overtimePlays } of Object.values(WP_FIXTURES)) {
    assert.equal(origin, "example");
    const pts = series.points;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      assert.ok(p.home_wp_pre >= 0 && p.home_wp_pre <= 1 && p.home_wp_post >= 0 && p.home_wp_post <= 1);
      assert.ok(Math.abs(p.delta_home_wp - (p.home_wp_post - p.home_wp_pre)) < 1e-9);
      if (i + 1 < pts.length) assert.equal(p.home_wp_post, pts[i + 1].home_wp_pre);
      if (i > 0) assert.ok(p.game_seconds_elapsed >= pts[i - 1].game_seconds_elapsed, "x-axis never rewinds");
    }
    // Lines stop at the end of regulation, so only non-OT games must end on the result.
    const final = pts.at(-1)!.home_wp_post;
    if (!series.has_overtime) assert.equal(final, series.result === "home_win" ? 1 : series.result === "away_win" ? 0 : 0.5);
    assert.deepEqual(series.swing_play_ids, pts.filter((p) => p.is_swing).map((p) => p.play_id));
    assert.equal(series.has_overtime, overtimePlays.length > 0);
  }
});

test("DET–KC: Detroit (away) won 21–20 everywhere", () => {
  const g = fixtureGame("2023_01_DET_KC")!;
  assert.equal(g.away_team_id, "DET");
  assert.equal(g.away_score, 21);
  assert.equal(g.home_score, 20);
  const wp = WP_FIXTURES["2023_01_DET_KC"].series;
  assert.equal(wp.result, "away_win");
  assert.equal(wp.points.at(-1)!.home_wp_post, 0);
  // QA H7: play rows carry no per-play win chance (the old opening-WP text came from fixtures).
  for (const p of fixturePlays("2023_01_DET_KC")!.items) assert.equal(p.reference, undefined);
});

test("backend is_swing flags win; threshold is only the fallback", () => {
  assert.equal(DEFAULT_SWING_WP_THRESHOLD, 0.08);
  assert.equal(isSwing({ delta_home_wp: 0.3, is_swing: false }), false);
  assert.equal(isSwing({ delta_home_wp: 0.01, is_swing: true }), true);
  assert.equal(isSwing({ delta_home_wp: 0.08 }), true);
  assert.equal(isSwing({ delta_home_wp: -0.079 }), false);
  const s = structuredClone(WP_FIXTURES["2023_01_DET_KC"].series);
  const only = s.points[3].play_id;
  for (const p of s.points) p.is_swing = p.play_id === only;
  const sw = findSwingPlays(s);
  assert.deepEqual(sw.map((x) => x.point.play_id), [only]);
});

test("swing plays are biggest first, at most 3, with a Why", () => {
  const sw = findSwingPlays(WP_FIXTURES["2023_01_DET_KC"].series);
  assert.equal(sw.length, 3);
  for (let i = 1; i < sw.length; i++) assert.ok(Math.abs(sw[i - 1].delta) >= Math.abs(sw[i].delta));
  const pick6 = sw.find((s) => /INTERCEPTED/.test(s.point.description ?? ""));
  assert.ok(pick6 && pick6.favored_team_id === "DET");
  assert.match(pick6.why, /interception returned for a touchdown/);
});

test("BUF@NYJ: Week 1, 2023-09-11, NYJ (home) wins 22–16 in OT", () => {
  const g = fixtureGame("2023_01_BUF_NYJ")!;
  assert.equal(g.week, 1);
  assert.equal(g.game_date, "2023-09-11");
  assert.equal(g.home_team_id, "NYJ");
  assert.equal(g.home_score, 22);
  assert.equal(g.away_score, 16);
  assert.equal(fixtureGame("2023_02_BUF_NYJ"), null);
  const s = WP_FIXTURES["2023_01_BUF_NYJ"].series;
  assert.equal(s.home_team_id, "NYJ");
  assert.equal(s.result, "home_win");
  assert.equal(s.has_overtime, true);
  // House rule: no overtime win chance ships; OT plays are kept without win chance.
  assert.ok(s.points.every((p) => !p.is_overtime && p.quarter <= 4));
  const ot = WP_FIXTURES["2023_01_BUF_NYJ"].overtimePlays;
  assert.equal(ot.length, 1);
  assert.match(ot[0].description, /Gipson/);
  assert.ok(!("home_wp_pre" in ot[0]) && !("home_wp_post" in ot[0]));
});

test("2240 P2-A: BUF_NYJ overtime plays carry display_text, not raw feed text", () => {
  const ot = WP_FIXTURES["2023_01_BUF_NYJ"].overtimePlays;
  const gipson = ot.find((p) => /Gipson/.test(p.raw_desc ?? ""))!;
  assert.equal(gipson.display_text, "Sam Martin punts 42 yards, and Xavier Gipson returns it 65 yards for a touchdown.");
  assert.match(gipson.raw_desc!, /^\(9:21\)/);
});

test("2240 P3-A + open item: swing meta reads as win chance; cards run in game order", () => {
  const sw = inGameOrder(findSwingPlays(WP_FIXTURES["2023_01_BUF_NYJ"].series));
  for (let i = 1; i < sw.length; i++) assert.ok(sw[i - 1].point.game_seconds_elapsed <= sw[i].point.game_seconds_elapsed);
  for (const s of sw) assert.match(swingMeta(s), /^[A-Z]{2,3} win chance \+\d+$/);
  assert.equal(swingMeta({ delta: -0.236, favored_team_id: "DET" }), "DET win chance +24");
});

test("clock labels from game_seconds_elapsed, including OT", () => {
  assert.equal(clockLabel({ quarter: 3, is_overtime: false, game_seconds_elapsed: 2075 }), "Q3 10:25");
  assert.equal(clockLabel({ quarter: 5, is_overtime: true, game_seconds_elapsed: 3748 }), "OT 7:32");
  // QA M9: Gipson's walk-off punt-return TD was at 9:21 of OT (nflverse), not 7:32.
  const ot = WP_FIXTURES["2023_01_BUF_NYJ"].overtimePlays[0];
  assert.equal(clockLabel(ot), "OT 9:21");
});

test("splitAtRegulation drops OT points and swing ids but keeps has_overtime", () => {
  for (const { series, overtimePlays } of Object.values(WP_FIXTURES)) {
    assert.ok(series.points.every((p) => p.quarter <= 4 && !p.is_overtime), series.game_id);
    assert.ok(series.swing_play_ids.every((id) => series.points.some((p) => p.play_id === id)));
    if (overtimePlays.length) assert.equal(series.has_overtime, true);
  }
});

test("H5: every displayed swing / chart play is a real export row (verified vs pbp in backend CI)", () => {
  for (const [id, { series, overtimePlays }] of Object.entries(WP_FIXTURES)) {
    const g = SWING_EXPORT.games[id];
    const rows = new Map([...g.chart, ...g.overtime_plays].map((r) => [r.play_id, r]));
    for (const p of [...series.points, ...overtimePlays]) {
      const r = rows.get(p.play_id);
      assert.ok(r, `${id} play ${p.play_id} not in swingPlays.json`);
      assert.equal(p.description, r.description);
      assert.equal(p.quarter, r.qtr);
    }
    for (const s of g.swings) assert.ok(rows.has(s.play_id), `${id} swing ${s.play_id}`);
  }
});

test("game pages carry the one real-source line, not an example label", async () => {
  const { WP_FIXTURES } = await import("./wpFixtures");
  const { GAME_SOURCE_LINE } = await import("./fixtures");
  assert.equal(GAME_SOURCE_LINE, "Real plays and win chance from nflverse (not our model).");
  for (const s of Object.values(WP_FIXTURES)) assert.equal(s.note, GAME_SOURCE_LINE);
});

test("M10: a failed fourth down's Why says the ball was handed over, not the score", async () => {
  const { WP_FIXTURES } = await import("./wpFixtures");
  const sw = Object.values(WP_FIXTURES).flatMap((s) => findSwingPlays(s.series));
  const tod = sw.filter((s) => (s.point as { event?: string }).event === "turnover_on_downs");
  assert.ok(tod.length > 0);
  for (const s of tod) {
    assert.match(s.why, /a failed fourth down handed the ball over/);
    assert.doesNotMatch(s.why, /score picture/);
  }
});

// QA2 H5: the old hand-made fixtures described plays that never happened.
const MADE_UP = [
  "Chiefs field goal.", "Lions touchdown run.", "Mahomes touchdown pass.", "Chiefs touchdown pass to retake the lead.",
  "Montgomery touchdown run puts Detroit ahead.", "Interception returned for a touchdown by Detroit.",
  "Jets field goal ties the game", "Fumble recovered by the Jets", "Opening kickoff.", "Opening drive sample play",
  "Fourth-and-1 — Detroit goes for it", "Mahomes incomplete on fourth down", "Final — Lions 21, Chiefs 20.",
];
test("H5: no made-up fixture text anywhere in the chart, swings, OT or play list", () => {
  for (const [id, { series, overtimePlays }] of Object.entries(WP_FIXTURES)) {
    const texts = [
      ...series.points.map((p) => p.description ?? ""),
      ...overtimePlays.map((p) => p.description ?? ""),
      ...(fixturePlays(id)?.items ?? []).map((p) => p.description ?? ""),
    ];
    for (const t of texts) for (const m of MADE_UP) assert.ok(!t.includes(m), `${id}: "${m}"`);
  }
});

test("#76: every rendered play row is a real row in lib/plays/<game_id>.json, in order, with its fan text", () => {
  for (const g of FIXTURE_GAMES.items) {
    const file = GAME_PLAY_LISTS[g.game_id];
    assert.ok(file, g.game_id);
    const rows = new Map(file.plays.map((p) => [p.play_id, p]));
    const items = fixturePlays(g.game_id)!.items;
    assert.ok(items.length > 100, `${g.game_id} has the full list`);
    let last = -1;
    for (const it of items) {
      const r = rows.get(it.play_id);
      assert.ok(r, `${g.game_id} play ${it.play_id} not in plays file`);
      assert.equal(it.description, r.display_text || r.raw_desc);
      assert.equal(it.quarter, r.qtr);
      const idx = file.plays.indexOf(r);
      assert.ok(idx > last, "game order");
      last = idx;
    }
  }
});

test("#76: chart and swing points are rows of the plays file", () => {
  for (const [id, { series }] of Object.entries(WP_FIXTURES)) {
    const ids = new Set(GAME_PLAY_LISTS[id].plays.map((p) => p.play_id));
    for (const p of series.points) assert.ok(ids.has(p.play_id), `${id} ${p.play_id}`);
  }
});

test("#88: opening win chance is per game, not the flat 56.68% home prior", () => {
  assert.equal(openingWinChance("2023_01_BUF_NYJ")!.away, 0.4332);
  assert.equal(openingWinChance("2023_03_PHI_TB")!.away, 0.4537);
  assert.equal(openingWinChance("2023_01_DET_KC")!.away, 0.4332);
  for (const id of Object.keys(WP_FIXTURES)) {
    const o = openingWinChance(id)!;
    assert.ok(Math.abs(o.home + o.away - 1) < 1e-6);
  }
});

test("#88/M10: failed fourth downs get the hands-the-ball-over Why and a down & distance line", () => {
  let n = 0;
  for (const { series } of Object.values(WP_FIXTURES))
    for (const s of findSwingPlays(series, 99)) {
      const p = s.point as EventPoint;
      if (!p.fourth_down_failed) continue;
      n++;
      assert.match(s.why, /a failed fourth down handed the ball over/);
      assert.match(situationLine(p, series.home_team_id, series.away_team_id) ?? "", /^4th & \d+/);
    }
  assert.ok(n > 0);
});

test("L5: DET_KC Q3 11:04 pick-six Why names the interception return TD", () => {
  const s = findSwingPlays(WP_FIXTURES["2023_01_DET_KC"].series).find((x) => clockLabel(x.point) === "Q3 11:04")!;
  assert.ok(s, "pick-six is a swing play");
  assert.equal((s.point as EventPoint).return_td, true);
  assert.match(s.why, /because an interception returned for a touchdown gave the defense a score/);
});

test("L5: a fumble return TD says fumble", () => {
  const p = { ...WP_FIXTURES["2023_01_DET_KC"].series.points[0], event: "fumble_lost", return_td: true } as EventPoint;
  assert.match(whyText(0.2, p, "DET"), /a fumble returned for a touchdown/);
});

test("L6: BUF_NYJ Q2 13:02 Breece Hall 83 yds says the gain moved the ball from deep in its own end", () => {
  const s = findSwingPlays(WP_FIXTURES["2023_01_BUF_NYJ"].series).find((x) => clockLabel(x.point) === "Q2 13:02")!;
  assert.ok(s, "Hall run is a swing play");
  assert.equal((s.point as EventPoint).yards_gained, 83);
  assert.match(s.why, /because an 83-yard gain moved the ball from deep in its own end/);
});

test("L5: Gipson's OT punt-return TD (return_td=false) gets no return-TD text", () => {
  const ot = SWING_EXPORT.games["2023_01_BUF_NYJ"].overtime_plays.find((r) => /Gipson returns it 65 yards/.test(r.display_text))!;
  assert.equal(ot.return_td, false);
  const p = { ...WP_FIXTURES["2023_01_BUF_NYJ"].series.points[0], event: ot.event, return_td: ot.return_td, yards_gained: ot.yards_gained, description: ot.description, is_overtime: true } as EventPoint;
  assert.doesNotMatch(whyText(0.3, p, "NYJ"), /returned for a touchdown/);
});

const base = () => ({ ...WP_FIXTURES["2023_01_DET_KC"].series.points[0] }) as EventPoint;

test("P2-K: Why is past tense, including the late-game tail", () => {
  const p = { ...base(), event: "punt", game_seconds_elapsed: 3500, is_overtime: false } as EventPoint;
  const t = whyText(0.2, p, "DET");
  assert.match(t, /a punt flipped field position, and with little time left there was less chance to answer\.$/);
  assert.match(whyText(0.2, { ...base(), event: "touchdown" } as EventPoint, "DET"), /a touchdown changed the score in one snap/);
  assert.doesNotMatch(t, /\b(hands|changes|flips|is less)\b/);
});

test("P3-K: big-gain wording depends on where the gain started or ended", () => {
  const g = (yl: number | null, y: number) => whyText(0.2, { ...base(), event: "pass", yardline_100: yl, yards_gained: y } as EventPoint, "DET");
  assert.match(g(85, 30), /a 30-yard gain moved the ball from deep in its own end/);
  assert.match(g(45, 30), /a 30-yard gain moved the ball into scoring range/);
  assert.match(g(70, 25), /a 25-yard gain flipped field position/);
  assert.match(g(null, 25), /a 25-yard gain flipped field position/);
});

test("P3-L: return TDs do not assume 7 points", () => {
  const t = whyText(0.2, { ...base(), event: "fumble_lost", return_td: true } as EventPoint, "DET");
  assert.match(t, /a fumble returned for a touchdown gave the defense a score/);
  assert.doesNotMatch(t, /7 points/);
});

test("#110 kick_return_td: punt and kickoff return TDs get their own wording; missing field is safe", () => {
  const k = (d: string, v?: boolean) => whyText(0.3, { ...base(), event: "touchdown", return_td: false, kick_return_td: v, description: d } as EventPoint, "NYJ");
  assert.match(k("B.Martin punts 46 yards. X.Gipson returns it 65 yards for a TOUCHDOWN", true), /a punt returned for a touchdown gave the return team a score/);
  assert.match(k("J.Bates kicks 65 yards. returns it 100 yards for a TOUCHDOWN", true), /a kickoff returned for a touchdown/);
  assert.match(k("punts ... TOUCHDOWN"), /a touchdown changed the score/);
});

test("article before yardage: 'an' for 8, 11, 18, 80–89; 'a' otherwise", () => {
  for (const n of [8, 11, 18, 80, 83, 89]) assert.equal(yardArticle(n), "an", String(n));
  for (const n of [1, 7, 10, 20, 21, 28, 38, 65, 79, 90, 99, 100, 111]) assert.equal(yardArticle(n), "a", String(n));
  assert.match(whyText(0.2, { ...base(), event: "pass", yardline_100: 60, yards_gained: 81 } as EventPoint, "DET"), /an 81-yard gain/);
});

test("QA 0116 N8: safeties and blocked kicks name the real cause, not the sack or punt", () => {
  const w = (event: string, description: string) => whyText(0.2, { ...base(), event, description, yards_gained: 0 } as EventPoint, "DET");
  assert.match(w("other", "(5:01) J.Goff sacked in End Zone for -8 yards, SAFETY."), /a safety gave the defense 2 points/);
  assert.doesNotMatch(w("other", "(5:01) J.Goff sacked in End Zone for -8 yards, SAFETY."), /sack lost yards/);
  assert.match(w("punt", "(2:00) M.Haack punt is BLOCKED by J.Doe, recovered by NE at IND 2."), /a blocked punt/);
  assert.match(w("field_goal", "(0:03) 44 yard field goal is BLOCKED."), /a blocked field goal/);
  assert.match(w("other", "(5:01) J.Goff sacked at DET 20 for -8 yards."), /a sack lost yards/);
});
