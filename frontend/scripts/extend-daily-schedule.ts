/**
 * Append-only extender for lib/dailySchedule.json. Existing dates are never touched.
 * New dates get 5 ids from the current pack, avoiding any id scheduled in the previous
 * cycleDays()-1 days (falling back to the least recently used when the pack is too small).
 * Usage: npx tsx scripts/extend-daily-schedule.ts 2027-12-31
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DAILY_ITEMS, DAILY_SET_SIZE, cycleDays, shuffled } from "../lib/daily";

const file = new URL("../lib/dailySchedule.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8")) as { note: string; days: Record<string, string[]> };
const until = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(until ?? "")) throw new Error("usage: extend-daily-schedule.ts YYYY-MM-DD");

const dates = Object.keys(data.days).sort();
const last = dates[dates.length - 1];
const lastUsed = new Map<string, number>();
dates.forEach((d, i) => data.days[d].forEach((id) => lastUsed.set(id, i)));
const order = shuffled(DAILY_ITEMS, `daily-schedule:${last}`).map((i) => i.id);
const window = cycleDays() - 1;

let idx = dates.length;
for (let t = Date.parse(`${last}T12:00:00Z`) + 86_400_000; ; t += 86_400_000) {
  const key = new Date(t).toISOString().slice(0, 10);
  if (key > until) break;
  const age = (id: string) => (lastUsed.has(id) ? idx - lastUsed.get(id)! : Infinity);
  const fresh = order.filter((id) => age(id) > window);
  const pick = (fresh.length >= DAILY_SET_SIZE ? fresh : [...order].sort((a, b) => age(b) - age(a))).slice(0, DAILY_SET_SIZE);
  data.days[key] = pick;
  pick.forEach((id) => lastUsed.set(id, idx));
  idx++;
}
const lines = Object.keys(data.days).sort().map((d) => `  ${JSON.stringify(d)}: ${JSON.stringify(data.days[d])}`);
writeFileSync(file, `{\n "note": ${JSON.stringify(data.note)},\n "days": {\n${lines.join(",\n")}\n }\n}\n`);
console.log(`schedule now ${Object.keys(data.days).length} days, through ${until}`);
