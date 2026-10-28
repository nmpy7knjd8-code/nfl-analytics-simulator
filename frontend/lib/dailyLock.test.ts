/**
 * Lock for #187 (themed packs are data-only): the regular daily 5 must stay byte-identical to main.
 * REGENERATE the fixture and hashes ONLY in a PR that intentionally changes the daily schedule/pack/snapshot:
 * fixture = dailySet(d) ids + reveal for every dailySnapshot.json date plus 2026-10-31..2026-12-31, from main's files;
 * hashes = sha256 of main's lib/dailyPack.json, dailySchedule.json, dailySnapshot.json.
 * Note: the daily-snapshot workflow's PR appends to dailySnapshot.json, so it must update DAILY_SHA256.dailySnapshot too.
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
  dailySnapshot: "d88996299c9b79fc76e3ee8767ea8b49c354b5fa8d7401e2cafe9cbef13d0c03",
};
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
