import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_ITEMS, dailySet } from "./daily";
import { addCoachDay, coachCall, coachTally, entryFor, loadCoach, saveCoach, verdictText, type CoachEntry } from "./coachTally";

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }; };

test("coach call comes from the real play for every pack item", () => {
  for (const it of DAILY_ITEMS) {
    const c = coachCall(it);
    if (it.historical_action === "go" || it.historical_action === "fg" || it.historical_action === "punt") assert.equal(c, it.historical_action, it.id);
    else assert.equal(c, null, it.id);
  }
});

test("verdict uses the frozen day's values and is honest both ways", () => {
  const it = dailySet("2026-10-27").find((i) => coachCall(i))!;
  const coach = coachCall(it)!;
  const other = (["go", "fg", "punt"] as const).find((c) => c !== coach && typeof it.reveal.values[c] === "number");
  assert.equal(entryFor("2026-10-27", it, coach)!.swing, 0);
  if (other) {
    const e = entryFor("2026-10-27", it, other)!;
    const raw = (it.reveal.values[other]! - it.reveal.values[coach]!) * 100;
    assert.ok(Math.abs(e.swing - raw) <= 0.5 || e.swing === 0);
  }
  const base: CoachEntry = { date: "d", id: "x", pick: "go", coach: "punt", swing: 4 };
  assert.match(verdictText(base), /liked your call: about \+4/);
  assert.match(verdictText({ ...base, swing: -3 }), /liked the coach's call: about \+3/);
  assert.match(verdictText({ ...base, swing: 0 }), /about even/);
  assert.doesNotMatch(verdictText(base), /EPA|WPA/);
});

test("tally survives reload, replaying a day doesn't double count, junk is ignored", () => {
  const st = mem();
  const e = (date: string, pick: "go" | "punt"): CoachEntry => ({ date, id: date, pick, coach: "go", swing: 0 });
  let es = addCoachDay([], "2026-10-27", [e("2026-10-27", "go"), e("2026-10-27", "punt")]);
  es = addCoachDay(es, "2026-10-27", [e("2026-10-27", "go"), e("2026-10-27", "punt")]);
  es = addCoachDay(es, "2026-10-28", [e("2026-10-28", "go")]);
  saveCoach(st, es);
  assert.deepEqual(coachTally(loadCoach(st)), { agreed: 2, differed: 1 });
  st.setItem("fourth-and-daily.coach.v1", "{bad");
  assert.deepEqual(loadCoach(st), []);
  st.setItem("fourth-and-daily.coach.v1", JSON.stringify([{ date: 1 }]));
  assert.deepEqual(loadCoach(st), []);
});

test("two played days (10 plays) count all 10 plays when every coach call is known", () => {
  const days = ["2026-10-27", "2026-10-28"];
  let es: CoachEntry[] = [];
  for (const d of days) {
    const set = dailySet(d);
    assert.equal(set.length, 5);
    const rows = set.map((it, i) => entryFor(d, it, i % 2 ? "punt" : coachCall(it)!)).filter((e): e is CoachEntry => e != null);
    es = addCoachDay(es, d, rows);
  }
  const known = days.flatMap((d) => dailySet(d)).filter((it) => coachCall(it)).length;
  const t = coachTally(es);
  assert.equal(t.agreed + t.differed, known);
  assert.equal(known, 10);
});
