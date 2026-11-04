/**
 * Append-only extender for lib/themeSchedule.json (B3). Never touches an existing date, and only adds
 * dates after the last published daily day (lib/dailySnapshot.json) and after today + 2 ET days.
 * Never edits dailySchedule.json or dailySnapshot.json.
 * Usage: npx tsx scripts/extend-theme-schedule.ts [YYYY-MM-DD]   (default: last dailySchedule date)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dateKey } from "../lib/daily";
import { extendThemeSchedule, firstThemeDate } from "../lib/themes";
import type { ThemeId, ThemeRules, ThemeSchedule } from "../contracts/themePacks";

const lib = (f: string) => new URL(`../lib/${f}`, import.meta.url);
const read = (u: URL) => JSON.parse(readFileSync(u, "utf8"));
const rules = read(lib("themeRules.json")) as ThemeRules;
const snap = read(lib("dailySnapshot.json")) as { days: Record<string, unknown> };
const daily = read(lib("dailySchedule.json")) as { days: Record<string, string[]> };
const file = lib("themeSchedule.json");
const sched: ThemeSchedule = existsSync(file) ? read(file) : {
  note: "Append-only. Never edit or remove a date. Themed bonus sets (B6/B3); rules in lib/themeRules.json. Extend: scripts/extend-theme-schedule.ts.",
  days: {},
};
const packIds = Object.fromEntries((["goal-line", "playoffs", "marathon"] as ThemeId[]).map((t) => [
  t, (read(new URL(`../public/data/packs/${t}.json`, import.meta.url)).items as { id: string }[]).map((i) => i.id),
])) as Record<ThemeId, string[]>;
const until = process.argv[2] ?? Object.keys(daily.days).sort().at(-1)!;
const first = firstThemeDate(Object.keys(snap.days), dateKey());
const before = Object.keys(sched.days).length;
sched.days = extendThemeSchedule(rules, packIds, sched.days, first, until);
const lines = Object.keys(sched.days).sort().map((d) => `  ${JSON.stringify(d)}: ${JSON.stringify(sched.days[d])}`);
writeFileSync(file, `{\n "note": ${JSON.stringify(sched.note)},\n "days": {\n${lines.join(",\n")}\n }\n}\n`);
console.log(`themeSchedule: ${Object.keys(sched.days).length - before} days added (first allowed ${first}, through ${until})`);
