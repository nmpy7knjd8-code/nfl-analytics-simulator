import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import daily from "./dailyPack.json";
import snapshot from "./dailySnapshot.json";
import schedule from "./dailySchedule.json";
import rules from "./themeRules.json";
import themeSchedule from "./themeSchedule.json";
import { extendThemeSchedule, firstThemeDate, snapshotThemes, themeScheduleIssues } from "./themes";
import themeSnapshot from "./themeSnapshot.json";
import { bestCalls, dateKey, type DailyItem } from "./daily";
import type { MarathonPack, ThemeDay, ThemeId, ThemePack, ThemeRules } from "../contracts/themePacks";

const THEMES: ThemeId[] = ["goal-line", "playoffs", "marathon"];
const pack = (t: ThemeId) => JSON.parse(readFileSync(new URL(`../public/data/packs/${t}.json`, import.meta.url), "utf8")) as ThemePack;
const DAILY_KEYS = Object.keys(daily.items[0]).sort();
const DAILY_BY_ID = new Map(daily.items.map((i) => [i.id, i]));
const SNAP_DAYS = Object.keys((snapshot as { days: Record<string, unknown> }).days).sort();
const TDAYS = (themeSchedule as { days: Record<string, ThemeDay> }).days;
const ids = (t: ThemeId) => pack(t).items.map((i) => i.id);

test("theme packs: daily item fields (+ driveId/playOrder on Marathon), unique ids, no EPA/xpass names", () => {
  for (const t of THEMES) {
    const p = pack(t);
    assert.equal(p.schema_version, "fourth_and_theme_pack.v1");
    assert.equal(p.theme, t);
    assert.ok(p.items.length >= 30, `${t}: ${p.items.length} items`);
    assert.equal(new Set(ids(t)).size, p.items.length, `${t} duplicate ids`);
    const extra = t === "marathon" ? ["drivePlays", "driveId", "playOrder"] : [];
    for (const it of p.items) {
      assert.deepEqual(Object.keys(it).sort(), [...DAILY_KEYS, ...extra].sort(), `${t} ${it.id} fields`);
      assert.deepEqual(Object.keys(it.situation).sort(), Object.keys(daily.items[0].situation).sort());
      assert.equal(it.id, `${it.source.game_id}-${it.source.play_id}`);
      const d = DAILY_BY_ID.get(it.id);
      if (d) assert.deepEqual({ ...it, driveId: undefined, playOrder: undefined, drivePlays: undefined }, { ...d, driveId: undefined, playOrder: undefined, drivePlays: undefined }, `${it.id} differs from dailyPack`);
    }
    assert.doesNotMatch(JSON.stringify(p.items.map((i) => Object.keys(i))), /epa|xpass/i);
  }
});

test("theme rules hold: goal line <= 5 yards, playoffs are postseason weeks, marathon drives", () => {
  for (const it of pack("goal-line").items) assert.ok(it.situation.yardline_100 <= 5, it.id);
  for (const it of pack("playoffs").items) assert.ok(it.source.week >= 19, it.id);
  for (const it of (pack("marathon") as MarathonPack).items) {
    assert.match(it.driveId, new RegExp(`^${it.source.game_id}-d\\d+$`));
    assert.ok(Number.isInteger(it.playOrder) && it.playOrder >= 1, it.id);
    assert.ok(Number.isInteger(it.drivePlays) && it.drivePlays >= 12 && it.playOrder <= it.drivePlays, it.id);
  }
});

test("theme schedule only uses unpublished dates, valid ids and the weekday rule", () => {
  const firstAllowed = "2026-10-31"; // last frozen daily day when B3 shipped: 2026-10-30
  const byDay = new Map((rules as ThemeRules).rules.map((r) => [r.weekday, r.theme]));
  for (const [d, day] of Object.entries(TDAYS)) {
    assert.ok(d >= firstAllowed, `${d} is a published day`);
    assert.equal(byDay.get(new Date(`${d}T12:00:00Z`).getUTCDay()), day.theme, d);
    assert.equal(day.ids.length, rules.setSize);
    for (const id of day.ids) assert.ok(ids(day.theme).includes(id), `${d} ${id} not in ${day.theme}`);
  }
});

test("extendThemeSchedule is append-only and never schedules before firstThemeDate", () => {
  const packIds = Object.fromEntries(THEMES.map((t) => [t, ids(t)])) as Record<ThemeId, string[]>;
  const first = firstThemeDate(["2026-10-29", "2026-10-30"], "2026-10-28");
  assert.equal(first, "2026-10-31");
  assert.equal(firstThemeDate(["2026-10-30", "2026-10-31"], "2026-10-28"), "2026-11-01");
  const a = extendThemeSchedule(rules as ThemeRules, packIds, {}, first, "2026-12-31");
  assert.ok(Object.keys(a).every((d) => d >= first));
  const b = extendThemeSchedule(rules as ThemeRules, packIds, a, "2027-01-05", "2027-02-28");
  for (const d of Object.keys(a)) assert.deepEqual(b[d], a[d], `${d} changed`);
  const once = extendThemeSchedule(rules as ThemeRules, packIds, {}, first, "2027-02-28");
  const resumed = extendThemeSchedule(rules as ThemeRules, packIds, a, first, "2027-02-28");
  assert.deepEqual(resumed, once, "resuming continues the same rotation");
  const committed = extendThemeSchedule(rules as ThemeRules, packIds, TDAYS, first, "2027-12-31");
  assert.deepEqual(committed, TDAYS, "themeSchedule.json is up to date");
});

test("themes leave the daily schedule and snapshot alone (frozen days intact)", () => {
  const days = (schedule as { days: Record<string, string[]> }).days;
  for (const d of SNAP_DAYS) assert.ok(days[d], d);
  for (const id of Object.values(TDAYS).flatMap((t) => t.ids)) assert.ok(typeof id === "string");
});

const packIdsAll = () => Object.fromEntries(THEMES.map((t) => [t, ids(t)])) as Record<ThemeId, string[]>;
const packItems = () => Object.fromEntries(THEMES.map((t) => [t, pack(t).items])) as never;
const best = (it: unknown) => bestCalls(it as DailyItem);
const SNAP = (themeSnapshot as { days: Record<string, never> }).days;

test("committed theme schedule passes the build check (ids resolve, frozen days unchanged, published days frozen)", () => {
  assert.deepEqual(themeScheduleIssues(TDAYS, packIdsAll(), SNAP, dateKey()), []);
});

test("snapshotThemes freezes through until only, append-only; frozen values survive a pack change", () => {
  const { days, added } = snapshotThemes(TDAYS, packItems(), {}, "2026-11-05", best);
  assert.deepEqual(added, ["2026-10-31", "2026-11-03", "2026-11-05"]);
  for (const d of added) assert.deepEqual(Object.keys(days[d].items), TDAYS[d].ids);
  const changed = JSON.parse(JSON.stringify(packItems())) as Record<ThemeId, { reveal: { values: Record<string, number> } }[]>;
  for (const t of THEMES) for (const it of changed[t]) for (const k of Object.keys(it.reveal.values)) it.reveal.values[k] = 0.5;
  const again = snapshotThemes(TDAYS, changed as never, days, "2026-11-10", best);
  for (const d of added) assert.deepEqual(again.days[d], days[d], `${d} refrozen`);
  assert.deepEqual(again.added, Object.keys(TDAYS).filter((d) => d > "2026-11-05" && d <= "2026-11-10").sort());
});

test("build check fails on a missing id, a changed or removed frozen day, and an unfrozen published day", () => {
  const { days: snap } = snapshotThemes(TDAYS, packItems(), {}, "2026-11-03", best);
  const ok = themeScheduleIssues(TDAYS, packIdsAll(), snap, "2026-11-03");
  assert.deepEqual(ok, []);
  const missing = { ...TDAYS, "2026-11-05": { ...TDAYS["2026-11-05"], ids: ["nope-1", ...TDAYS["2026-11-05"].ids.slice(1)] } };
  assert.match(themeScheduleIssues(missing, packIdsAll(), snap, "2026-11-03").join(), /nope-1 missing from marathon/);
  const swapped = { ...TDAYS, "2026-10-31": { ...TDAYS["2026-10-31"], ids: [...TDAYS["2026-10-31"].ids].reverse() } };
  assert.match(themeScheduleIssues(swapped, packIdsAll(), snap, "2026-11-03").join(), /2026-10-31: frozen themed day changed/);
  const { ["2026-11-03"]: _gone, ...removed } = TDAYS;
  assert.match(themeScheduleIssues(removed, packIdsAll(), snap, "2026-11-03").join(), /2026-11-03: frozen themed day was removed/);
  assert.match(themeScheduleIssues(TDAYS, packIdsAll(), {}, "2026-11-03").join(), /2026-10-31: published themed day is not frozen/);
});
