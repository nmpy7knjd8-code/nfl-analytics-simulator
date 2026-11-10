import { test } from "node:test";
import assert from "node:assert/strict";
// Frozen copy of 2022_03_NO_CAR-2560 with the tie it had when these tests were written;
// model rebuilds may move its live values, but the tie-scoring rules need a real tie.
import tieItemJson from "./tieItem.fixture.json";
import { QUIZ_PACK } from "./quiz";
// @ts-expect-error plain .mjs build script
import { slim } from "../scripts/build-daily-pack.mjs";
import dailyPack from "./dailyPack.json";
import {
  cycleDays, dailySet, dateKey, emptyStreak, msUntilNextSet, optionStates, recordDaily,
  scoreCall, shareText, DAILY_ITEMS, type DailyItem, visibleStreak, dailyStats, dayNumber, DAILY_SET_SIZE,
} from "./daily";

test("same instant → same ET day and same 5, whatever the browser's time zone", () => {
  // 03:30 UTC Oct 27 is still Oct 26 in New York; a Tokyo or LA clock must agree.
  const instant = new Date("2026-10-27T03:30:00Z");
  assert.equal(dateKey(instant), "2026-10-26");
  const prev = process.env.TZ;
  const sets = ["Asia/Tokyo", "America/Los_Angeles", "UTC"].map((tz) => {
    process.env.TZ = tz;
    return dailySet(dateKey(new Date(instant.getTime()))).map((i) => i.id).join(",");
  });
  process.env.TZ = prev;
  assert.equal(new Set(sets).size, 1);
  assert.equal(sets[0].split(",").length, DAILY_SET_SIZE);
});

test("set changes exactly at midnight ET (EDT and EST)", () => {
  assert.equal(dateKey(new Date("2026-10-27T03:59:59Z")), "2026-10-26"); // 23:59:59 EDT
  assert.equal(dateKey(new Date("2026-10-27T04:00:00Z")), "2026-10-27");
  assert.equal(dateKey(new Date("2026-12-01T04:59:59Z")), "2026-11-30"); // EST
  assert.equal(dateKey(new Date("2026-12-01T05:00:00Z")), "2026-12-01");
  assert.equal(msUntilNextSet(new Date("2026-10-27T03:59:00Z")), 60_000);
  // DST end night (Nov 1 2026 is 25 hours long in New York)
  assert.equal(msUntilNextSet(new Date("2026-11-01T04:00:00Z")), 25 * 3_600_000);
});

test("no play repeats inside a cycle; schedule is fixed per date", () => {
  const days = cycleDays();
  assert.equal(days, 73);
  const seen = new Set<string>();
  const start = dayNumber("2026-10-26") - (dayNumber("2026-10-26") % days);
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + start + i)).toISOString().slice(0, 10);
    for (const it of dailySet(d, [...DAILY_ITEMS])) { // shuffle fallback (custom list skips the schedule)
      assert.ok(!seen.has(it.id), `repeat ${it.id} on ${d}`);
      seen.add(it.id);
    }
  }
  assert.equal(seen.size, days * DAILY_SET_SIZE);
  assert.deepEqual(dailySet("2026-10-26"), dailySet("2026-10-26"));
});

test("streak counts across the ET boundary and resets after a missed day", () => {
  let s = emptyStreak();
  // Finish at 23:58 ET Oct 26, then 00:01 ET Oct 27: two consecutive days.
  s = recordDaily(s, { date: dateKey(new Date("2026-10-27T03:58:00Z")), credit: 4, answered: 5 });
  s = recordDaily(s, { date: dateKey(new Date("2026-10-27T04:01:00Z")), credit: 3, answered: 5 });
  assert.equal(s.current, 2);
  s = recordDaily(s, { date: "2026-10-27", credit: 5, answered: 5 });
  assert.equal(s.current, 2, "replaying a day doesn't double count");
  assert.equal(visibleStreak(s, "2026-10-28"), 2);
  assert.equal(visibleStreak(s, "2026-10-29"), 0);
  s = recordDaily(s, { date: "2026-10-29", credit: 1, answered: 5 });
  assert.equal(s.current, 1);
  assert.equal(s.best, 2);
  assert.deepEqual(dailyStats(s, "2026-10-29").score_distribution, [0, 1, 0, 1, 1, 0]);
});

test("share text has no spoilers", () => {
  const t = shareText("2026-10-26", ["right", "right", "wrong", "right", "close"], 4, "https://x.test/");
  assert.equal(t, "Fourth & Daily · Oct 26\n🟦🟦⬜🟦½\n3.5/5 · streak 4\nhttps://x.test/");
  const teams = new Set(DAILY_ITEMS.flatMap((i) => [i.situation.posteam, i.situation.defteam]));
  for (const tm of teams) assert.ok(!new RegExp(`\\b${tm}\\b`).test(t));
  assert.doesNotMatch(t, /\b(go|kick|punt|field goal|4th)\b/i);
});

test("option rules: Kick disabled past 64 yd, Punt hidden inside the opponent 35", () => {
  for (const it of DAILY_ITEMS) {
    const o = Object.fromEntries(optionStates(it).map((x) => [x.id, x]));
    if (it.situation.yardline_100 + 18 > 64) assert.ok(o.fg.disabled);
    if (it.situation.yardline_100 < 35) assert.equal(o.punt.shown, false);
    // The model's pick is always something the player can choose.
    const best = scoreCall("go", it).best;
    assert.ok(o[best].shown && !o[best].disabled, it.id);
  }
});

test("#93: top pick is Right even in a close call; the near option is ½; others 0", () => {
  const base = { ...DAILY_ITEMS[0], situation: { ...DAILY_ITEMS[0].situation, yardline_100: 40 } };
  const it: DailyItem = { ...base, reveal: { ...base.reveal, values: { go: 0.5, punt: 0.49, fg: 0.3 } } };
  assert.equal(scoreCall("go", it).result, "right");
  assert.equal(scoreCall("go", it).credit, 1);
  assert.equal(scoreCall("punt", it).result, "close");
  assert.equal(scoreCall("punt", it).credit, 0.5);
  assert.equal(scoreCall("fg", it).result, "wrong");
  const clear: DailyItem = { ...base, reveal: { ...base.reveal, values: { go: 0.6, punt: 0.4 } } };
  assert.equal(scoreCall("go", clear).result, "right");
  assert.equal(scoreCall("punt", clear).result, "wrong");
  // A kick past 64 yd never scores, even when its value is the top.
  const far: DailyItem = { ...base, situation: { ...base.situation, yardline_100: 60 }, reveal: { ...base.reveal, values: { go: 0.4, punt: 0.39, fg: 0.41 } } };
  assert.equal(scoreCall("fg", far).credit, 0);
  assert.equal(scoreCall("go", far).result, "right");
  assert.equal(scoreCall("punt", far).result, "close");
});

test("pack is real plays only, with NFL teams and quarter clocks", () => {
  for (const it of DAILY_ITEMS) {
    assert.equal(it.kind, "historical");
    assert.match(it.source.game_id ?? "", /^20\d\d_\d\d_[A-Z]{2,3}_[A-Z]{2,3}$/);
    assert.ok(it.situation.quarter_seconds_remaining >= 0 && it.situation.quarter_seconds_remaining <= 900);
  }
});

test("dailyPack.json is exactly the slim form of quizPack.json (no drift, no invented data)", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(slim(QUIZ_PACK))), dailyPack);
});

test("rounded daily values keep every model pick and close-call verdict", () => {
  const full = new Map(QUIZ_PACK.items.map((i) => [i.id, i]));
  for (const it of DAILY_ITEMS) {
    const f = full.get(it.id)!;
    const asDaily = { ...it, reveal: { ...it.reveal, values: f.reveal.values } } as DailyItem;
    for (const c of ["go", "fg", "punt"] as const) {
      if (it.reveal.values[c] == null) continue;
      const a = scoreCall(c, it), b = scoreCall(c, asDaily);
      assert.equal(a.best, b.best, it.id);
      assert.equal(a.result, b.result, it.id);
    }
  }
});

test("#93 close-call notes and L8 one-decimal percents", async () => {
  const { closeNote, formatPercents } = await import("./daily");
  assert.deepEqual(formatPercents([0.621, 0.617]), ["62.1%", "61.7%"]);
  assert.deepEqual(formatPercents([0.63, 0.5]), ["63%", "50%"]);
  const base = { ...DAILY_ITEMS[0], situation: { ...DAILY_ITEMS[0].situation, yardline_100: 40 } };
  const it: DailyItem = { ...base, reveal: { ...base.reveal, values: { go: 0.621, punt: 0.617, fg: 0.3 } } };
  assert.equal(closeNote(scoreCall("go", it)), "Punting was about as good (61.7%).");
  assert.equal(closeNote(scoreCall("punt", it)), "Going for it was a little better (62.1% vs 61.7%), so this pick gets ½.");
  assert.equal(closeNote(scoreCall("fg", it)), null);
});

test("#96 L7: close-call Why names only options within 2 pts as about the same", async () => {
  const { whyText } = await import("./dailyView");
  const base = { ...DAILY_ITEMS[0], situation: { ...DAILY_ITEMS[0].situation, yardline_100: 40 } };
  const it: DailyItem = { ...base, reveal: { ...base.reveal, values: { go: 0.621, punt: 0.617, fg: 0.3 } } };
  const t = whyText(it, scoreCall("go", it));
  assert.match(t, /\(62\.1% vs 61\.7%\) give about the same win chance; .* is lower \(30\.0%\)\./);
});

test("M13: daily close-call text never shows identical 'X% vs X%'", async () => {
  const { closeNote } = await import("./daily");
  const n = closeNote({ result: "close", credit: 0.5, pick: "fg", best: "go", gap: 0.0001, closeCall: true, values: { go: 0.0012, fg: 0.0011, punt: 0.00105 } } as never)!;
  assert.doesNotMatch(n, /(\d+(?:\.\d)?%) vs \1/);
  assert.match(n, /both 0\.1%/);
});

test("0015 P1-B: CAR-NO Q3 5:11, Kick and Go both show 91.9%, so both are Right", () => {
  const item = (tieItemJson as unknown as (typeof DAILY_ITEMS)[number]);
  for (const pick of ["fg", "go"] as const) {
    const s = scoreCall(pick, item);
    assert.equal(s.result, "right", pick);
    assert.equal(s.credit, 1, pick);
  }
  assert.equal(scoreCall("punt", item).credit, 0.5);
});

test("0015 P1-A: Why groups equal shown values (CAR-NO Q3 5:11)", async () => {
  const { whyText, groupedNames } = await import("./dailyView");
  const item = (tieItemJson as unknown as (typeof DAILY_ITEMS)[number]);
  assert.equal(
    whyText(item, scoreCall("go", item)),
    "Close call for the Panthers: Kick and Go (both 91.9%) and Punt (90.8%) give about the same win chance.",
  );
  assert.equal(groupedNames(["Kick", "Go", "Punt"], ["9%", "9%", "9%"]), "Kick, Go and Punt (all 9%)");
  assert.equal(groupedNames(["Go", "Kick"], ["24%", "23%"]), "Go and Kick (24% vs 23%)");
  assert.equal(groupedNames(["Go", "Kick", "Punt"], ["24%", "23%", "22%"]), "Go, Kick and Punt (24% vs 23% vs 22%)");
});

test("0015 follow-up: CAR-NO Q3 5:11, Kick and Go tie at 91.9% so both are Best; Punt is About as good", async () => {
  const { barTags } = await import("./dailyView");
  const item = (tieItemJson as unknown as (typeof DAILY_ITEMS)[number]);
  const t = barTags(item, scoreCall("punt", item));
  assert.deepEqual(t.fg, { tag: "Best", best: true });
  assert.deepEqual(t.go, { tag: "Best", best: true });
  assert.deepEqual(t.punt, { tag: "Your pick", best: false });
  // A tied pick keeps its one tag but gets the blue bar; the other tied row is still Best.
  const g = barTags(item, scoreCall("go", item));
  assert.deepEqual(g.go, { tag: "Your pick", best: true });
  assert.deepEqual(g.fg, { tag: "Best", best: true });
  assert.equal(g.punt?.tag, "About as good");
});

// P1 schedule pin tests live in their own file; imported here so npm test runs them without a package.json change.
import "./dailySchedule.test";
