import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import daily from "./dailyPack.json";
import snapshot from "./dailySnapshot.json";
import schedule from "./dailySchedule.json";
import rules from "./themeRules.json";
import themeSchedule from "./themeSchedule.json";
import { extendThemeSchedule, firstThemeDate } from "./themes";
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
    const extra = t === "marathon" ? ["driveId", "playOrder"] : [];
    for (const it of p.items) {
      assert.deepEqual(Object.keys(it).sort(), [...DAILY_KEYS, ...extra].sort(), `${t} ${it.id} fields`);
      assert.deepEqual(Object.keys(it.situation).sort(), Object.keys(daily.items[0].situation).sort());
      assert.equal(it.id, `${it.source.game_id}-${it.source.play_id}`);
      const d = DAILY_BY_ID.get(it.id);
      if (d) assert.deepEqual({ ...it, driveId: undefined, playOrder: undefined }, { ...d, driveId: undefined, playOrder: undefined }, `${it.id} differs from dailyPack`);
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
