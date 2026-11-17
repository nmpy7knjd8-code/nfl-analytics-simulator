import test from "node:test";
import assert from "node:assert/strict";
import { LATEST_SEASON, SEASONS, readSeason, gradeCell, wentWhenShould, regulationOnly, coachHref, signedPts, MIN_CALLS } from "./coaches";
import { coachSeasons, seasonRangeText } from "./seasons";

test("coach seasons follow the coach files, latest last", () => {
  assert.deepEqual([...SEASONS], coachSeasons());
  assert.equal(LATEST_SEASON, SEASONS.at(-1));
  assert.equal(seasonRangeText(SEASONS), "2019–2025");
});

test("every season file is coaches.v1.2 with min 20 calls", () => {
  for (const s of SEASONS) {
    const d = readSeason(s);
    assert.equal(d.schema_version, "coaches.v1.2");
    for (const c of d.coaches)
      for (const call of [...c.best, ...c.worst]) {
        assert.ok(!("play_id" in call), "no play_id in published calls");
        assert.match(call.clock, /^\d{1,2}:\d{2}$/);
      }
    assert.equal(d.season, s);
    assert.equal(d.min_calls_for_grade, MIN_CALLS);
    assert.ok(d.coaches.length >= 30);
  }
});

test("coaches under 20 calls are ungraded: 'Not enough calls'", () => {
  let n = 0;
  for (const s of SEASONS)
    for (const c of readSeason(s).coaches)
      if (c.qualifying_calls < 20) {
        n++;
        assert.deepEqual(gradeCell(c), { kind: "not-enough", text: "Not enough calls" });
      }
  assert.ok(n >= 5, "fixtures include short-tenure coaches");
  const quinn = readSeason(2020).coaches.find((c) => c.coach === "Dan Quinn")!;
  assert.equal(gradeCell(quinn).kind, "not-enough");
  // Even a letter in the file must not show for < 20 calls.
  assert.equal(gradeCell({ ...quinn, grade: "A" }).kind, "not-enough");
});

test("no invented grades: no letter unless the data file has one", () => {
  for (const s of SEASONS)
    for (const c of readSeason(s).coaches) {
      assert.equal(c.grade, null);
      const g = gradeCell(c);
      assert.notEqual(g.kind, "grade");
      if (c.qualifying_calls >= 20) assert.equal(g.text, "No grade");
    }
});

test("table numbers come straight from the file", () => {
  const c = readSeason(2023).coaches.find((x) => x.team === "ARI")!;
  assert.equal(wentWhenShould(c), 5 / 9);
  assert.equal(signedPts(c.net_wp_pts), "−41.8");
  assert.equal(signedPts(0), "0.0");
  assert.equal(coachHref("ARI", 2023), "/coaches/ARI/2023/");
  assert.equal(wentWhenShould({ ...c, should_go: 0 }), null);
});

test("best/worst calls are 5 each and overtime calls are dropped", () => {
  for (const s of SEASONS)
    for (const c of readSeason(s).coaches) {
      assert.ok(c.best.length <= 5 && c.worst.length <= 5);
      for (const call of regulationOnly([...c.best, ...c.worst])) assert.ok(call.qtr <= 4);
    }
  assert.equal(regulationOnly([{ qtr: 5 } as never]).length, 0);
});

import { avgAmount, avgPerCall, avgText, rankCoaches, AVG_LINE } from "./coaches";
test("average per call replaces the season sum", () => {
  const reid = readSeason(2023).coaches.find((c) => c.team === "KC")!;
  assert.equal(avgText(reid), "0.4% less chance to win per call");
  assert.equal(avgAmount(0.21), "0.2% more chance to win per call");
  assert.equal(avgAmount(-0.01), "Same chance to win as the model"); // −58.21 over 137 calls
  const r = rankCoaches(readSeason(2023).coaches);
  for (let i = 1; i < r.length; i++) assert.ok(avgPerCall(r[i - 1]) >= avgPerCall(r[i]));
  assert.doesNotMatch(AVG_LINE, /calibrat|EPA|WPA|odds|bet/i);
});

import { weekLabel } from "./coaches";
test("playoff weeks show the round, not the week number", () => {
  assert.deepEqual([18, 19, 20, 21, 22].map((w) => weekLabel(2023, w)), ["Week 18", "Wild Card", "Divisional", "Conference Championship", "Super Bowl"]);
  assert.deepEqual([17, 18, 21].map((w) => weekLabel(2020, w)), ["Week 17", "Wild Card", "Super Bowl"]);
  const kc = readSeason(2023).coaches.find((c) => c.team === "KC")!;
  assert.ok(kc.worst.some((c) => c.week === 19));
});

test("best calls: regulation only, ranked by alt_cost_pts, plain wording", async () => {
  const { bestCalls, bestNote, readSeason } = await import("./coaches");
  const kc = readSeason(2023).coaches.find((c) => c.team === "KC")!;
  const b = bestCalls(kc.best);
  assert.ok(b.length > 0);
  assert.ok(b.every((c) => c.qtr <= 4 && c.alt_cost_pts > 0));
  for (let i = 1; i < b.length; i++) assert.ok(b[i - 1].alt_cost_pts >= b[i].alt_cost_pts);
  assert.equal(bestNote(b[0]), "10.7% more chance to win than the next-best choice.");
  assert.doesNotMatch(bestNote(b[0]), /EPA|WPA|odds|bet/i);
});

test("rendered /coaches and coach pages never say pts or points", async () => {
  const React = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  (globalThis as unknown as { React: typeof React }).React = React;
  const { CoachesSeasonPage, CoachBlock } = await import("../components/CoachesView");
  const { readSeason } = await import("./coaches");
  const strip = (html: string) => html.replace(/<[^>]+>/g, " ");
  const bad = /\b(pts|points)\b/i;
  for (const season of SEASONS) {
    const data = readSeason(season);
    assert.doesNotMatch(strip(renderToStaticMarkup(React.createElement(CoachesSeasonPage, { data }))), bad);
    for (const c of data.coaches) {
      const text = strip(renderToStaticMarkup(React.createElement(CoachBlock, { c })));
      assert.doesNotMatch(text, bad, `${c.team} ${season}`);
    }
  }
});
