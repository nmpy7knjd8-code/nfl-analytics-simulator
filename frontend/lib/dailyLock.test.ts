/**
 * Lock for #187 (themed packs are data-only): the regular daily 5 must stay byte-identical to main.
 * REGENERATE the fixture and hashes ONLY in a PR that intentionally changes the daily schedule/pack/snapshot:
 * fixture = dailySet(d) ids + reveal for every dailySnapshot.json date plus 2026-10-31..2026-12-31, from main's files;
 * hashes = sha256 of main's lib/dailyPack.json and dailySchedule.json, plus sha256(JSON.stringify(entry)) of each frozen
 * dailySnapshot.json day (2026-10-26..30). Days the nightly snapshot appends later need no edit here: they must equal the
 * fixture selection for that date.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// Theme code first: loading and running it must not change the daily results below.
import { extendThemeSchedule, snapshotThemes, themeScheduleIssues } from "./themes";
import { THEME_IDS, loadPacks, loadSchedule, loadSnapshot } from "./themeData";
import { bestCalls, dailySet, type DailyItem } from "./daily";
import expected from "./__fixtures__/dailySelection.expected.json";

const DAILY_SHA256: Record<string, string> = {
  dailyPack: "a4858461fe468053ef8222813003e8a629a5ffbffaf0b30519fede7e3c5f71f5",
  dailySchedule: "18215d29d05bd6ec96cb5405148cf99ce30a339583a32553627be47152addeb9",
};
/** Frozen days as of #187: sha256 of JSON.stringify(dailySnapshot.days[d]) (ids, order, values, best). */
const FROZEN_DAY_SHA256: Record<string, string> = {
  "2026-10-26": "b916ac4a00191c335055e51191c13570fa954fc09713cda66f85047be3875135",
  "2026-10-27": "16d2ff5a871fdb6cdd1d5ec2d7036da82564dcd8c2924543dbcc3549209c58ba",
  "2026-10-28": "549946c3cace317f06b2107bb5e23e71a78733a4b4f8f8e71feb493032afb2b7",
  "2026-10-29": "86b648f3140d2fca0802aee0b4c2ec35a4d9133f8ccb8b6e0362b56a4a26b249",
  "2026-10-30": "5603053219bda0356df5377fa0558269db68afc7a049d76009bc9deb5522fafd",
};
type SnapEntry = { recommendation: string; values: Record<string, number>; best: string[] };
const readSnapshot = () => (JSON.parse(readFileSync(new URL("./dailySnapshot.json", import.meta.url), "utf8")) as { days: Record<string, Record<string, SnapEntry>> }).days;
type Pick = { id: string; recommendation: string; values: Record<string, number> };
const EXPECTED = (expected as { days: Record<string, Pick[]> }).days;
const selection = (d: string): Pick[] =>
  dailySet(d).map((i) => ({ id: i.id, recommendation: i.reveal.recommendation, values: i.reveal.values as Record<string, number> }));

test("daily files match the pinned sha256 of main's versions", () => {
  for (const [f, want] of Object.entries(DAILY_SHA256)) {
    const got = createHash("sha256").update(readFileSync(new URL(`./${f}.json`, import.meta.url))).digest("hex");
    assert.equal(got, want, `${f}.json changed (regenerate only in a PR that intentionally changes the daily schedule)`);
  }
});

test("dailySnapshot.json: frozen days 10-26..10-30 unchanged; appended days only after them and equal the fixture", () => {
  const snap = readSnapshot();
  for (const [d, want] of Object.entries(FROZEN_DAY_SHA256)) {
    assert.ok(snap[d], `frozen day ${d} removed`);
    assert.equal(createHash("sha256").update(JSON.stringify(snap[d])).digest("hex"), want, `frozen day ${d} changed`);
  }
  const lastFrozen = Object.keys(FROZEN_DAY_SHA256).sort().at(-1)!;
  for (const [d, day] of Object.entries(snap)) {
    if (FROZEN_DAY_SHA256[d]) continue;
    assert.ok(d > lastFrozen, `${d}: snapshot day added before the last frozen day`);
    const want = EXPECTED[d];
    if (!want) continue; // past the fixture range (after 2026-12-31): covered by dailySnapshot.test.ts
    assert.deepEqual(Object.keys(day), want.map((p) => p.id), `${d} appended ids differ from the fixture`);
    for (const p of want) {
      assert.deepEqual(day[p.id].values, p.values, `${d} ${p.id} values`);
      assert.equal(day[p.id].recommendation, p.recommendation, `${d} ${p.id} recommendation`);
    }
  }
});

test("daily 5 for every frozen day and 2026-10-31..2026-12-31 match the fixture from main", () => {
  assert.ok(EXPECTED["2026-10-26"] && EXPECTED["2026-10-31"] && EXPECTED["2026-12-31"]);
  assert.ok(Object.keys(EXPECTED).length >= 62);
  for (const [d, want] of Object.entries(EXPECTED)) assert.deepEqual(selection(d), want, d);
});

test("running the theme code paths leaves the daily selection unchanged", () => {
  const before = Object.fromEntries(Object.keys(EXPECTED).map((d) => [d, selection(d)]));
  const packs = loadPacks();
  const ids = Object.fromEntries(THEME_IDS.map((t) => [t, packs[t].items.map((i) => i.id)])) as never;
  const sched = extendThemeSchedule({ note: "", setSize: 5, rules: [{ theme: "goal-line", weekday: 1 }] }, ids, loadSchedule().days, "2026-10-29", "2027-12-31");
  snapshotThemes(sched, Object.fromEntries(THEME_IDS.map((t) => [t, packs[t].items])) as never, loadSnapshot().days, "2027-12-31", (it) => bestCalls(it as unknown as DailyItem));
  themeScheduleIssues(sched, ids, loadSnapshot().days, "2027-12-31");
  for (const [d, want] of Object.entries(EXPECTED)) assert.deepEqual(selection(d), want, `${d} after theme code`);
  assert.deepEqual(Object.fromEntries(Object.keys(EXPECTED).map((d) => [d, selection(d)])), before);
});
