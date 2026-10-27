/**
 * Append-only extender for lib/dailySchedule.json. Existing dates are never touched.
 * New dates get 5 ids from the current pack, avoiding any id scheduled in the previous
 * cycleDays()-1 days (falling back to the least recently used when the pack is too small).
 * Usage: npx tsx scripts/extend-daily-schedule.ts 2027-12-31
 *
 * Retiring ids (e.g. quiz items Data & Models is pulling from the pack):
 *   npx tsx scripts/extend-daily-schedule.ts --retire id1,id2 [--from YYYY-MM-DD]
 * Adds the ids to lib/retiredDailyIds.json, then rebuilds every date >= --from (default and
 * minimum: today + 2 ET days, so no day anyone may be playing changes) through the current last
 * date, with the same no-repeat rule, from the pack minus all retired ids. Earlier dates stay.
 * A full rebuild is needed: the schedule cycles the whole pack, so every id already recurs
 * every cycleDays() days and there is no gap a single slot swap could fill.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DAILY_ITEMS, DAILY_SET_SIZE, cycleDays, dateKey, shuffled } from "../lib/daily";

const file = new URL("../lib/dailySchedule.json", import.meta.url);
const retiredFile = new URL("../lib/retiredDailyIds.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8")) as { note: string; days: Record<string, string[]> };
const retired = new Set(JSON.parse(readFileSync(retiredFile, "utf8")) as string[]);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
const nextDay = (key: string) => new Date(Date.parse(`${key}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

let until = process.argv[2];
let seedKey: string | undefined;
const before = JSON.stringify(data.days);
const old = { ...data.days };
const retireArg = arg("--retire");
if (retireArg) {
  retireArg.split(",").map((s) => s.trim()).filter(Boolean).forEach((id) => retired.add(id));
  const minFrom = nextDay(nextDay(dateKey()));
  const from = arg("--from") ?? minFrom;
  if (!DATE.test(from)) throw new Error("--from must be YYYY-MM-DD");
  if (from < minFrom) throw new Error(`--from ${from} is too soon; earliest editable date is ${minFrom}`);
  const dates = Object.keys(data.days).sort();
  until = dates[dates.length - 1];
  for (const d of dates) if (d >= from) delete data.days[d];
  seedKey = `retire:${from}`;
  writeFileSync(retiredFile, JSON.stringify([...retired].sort(), null, 1) + "\n");
}
if (!DATE.test(until ?? "")) throw new Error("usage: extend-daily-schedule.ts YYYY-MM-DD | --retire ids [--from YYYY-MM-DD]");

const items = DAILY_ITEMS.filter((i) => !retired.has(i.id));
const dates = Object.keys(data.days).sort();
const last = dates[dates.length - 1];
const lastUsed = new Map<string, number>();
dates.forEach((d, i) => data.days[d].forEach((id) => lastUsed.set(id, i)));
const order = shuffled(items, `daily-schedule:${seedKey ?? last}`).map((i) => i.id);
const window = cycleDays(items) - 1;

let idx = dates.length;
for (let key = nextDay(last); key <= until!; key = nextDay(key)) {
  const age = (id: string) => (lastUsed.has(id) ? idx - lastUsed.get(id)! : Infinity);
  const fresh = order.filter((id) => age(id) > window);
  const pick = (fresh.length >= DAILY_SET_SIZE ? fresh : [...order].sort((a, b) => age(b) - age(a))).slice(0, DAILY_SET_SIZE);
  data.days[key] = pick;
  pick.forEach((id) => lastUsed.set(id, idx));
  idx++;
}
const lines = Object.keys(data.days).sort().map((d) => `  ${JSON.stringify(d)}: [${data.days[d].map((id) => JSON.stringify(id)).join(", ")}]`);
writeFileSync(file, `{\n "note": ${JSON.stringify(data.note)},\n "days": {\n${lines.join(",\n")}\n }\n}\n`);
let changed = 0;
for (const d of Object.keys(old)) changed += old[d].filter((id, k) => data.days[d][k] !== id).length;
console.log(`schedule now ${Object.keys(data.days).length} days, through ${until}; ${changed} existing slots changed${before === JSON.stringify(data.days) ? " (none)" : ""}`);
