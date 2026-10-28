import test from "node:test";
import assert from "node:assert/strict";
import { SEASONS, readSeason, gradeCell, wentWhenShould, regulationOnly, coachHref, signedPts, MIN_CALLS } from "./coaches";

test("every season file is coaches.v1 with min 20 calls", () => {
  for (const s of SEASONS) {
    const d = readSeason(s);
    assert.equal(d.schema_version, "coaches.v1");
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

test("no invented grades: everyone else waits for the calibrated model", () => {
  for (const s of SEASONS)
    for (const c of readSeason(s).coaches) {
      assert.equal(c.grade, null);
      const g = gradeCell(c);
      assert.notEqual(g.kind, "grade");
      if (c.qualifying_calls >= 20) assert.equal(g.text, "Grade coming once the model is calibrated");
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
