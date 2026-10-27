/**
 * Append-only writer for lib/dailySnapshot.json: freezes each published day's reveal values and best
 * call(s) so a later pack/model rebuild can't regrade it (Critic 0155 after #122). Existing dates are
 * never touched. Appends every scheduled date up to <date> (default: today ET + 2 days) that's missing, from the
 * current pack, so days are frozen ahead of publication. New model values reach only days past that.
 * Runs before build:pages; commit the result each day (the build test fails if today is missing).
 * Usage: npx tsx scripts/snapshot-daily.ts [YYYY-MM-DD] [--pack path/to/dailyPack.json]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { DAILY_ITEMS, DAILY_SCHEDULE, bestCalls, dateKey, type DailyItem } from "../lib/daily";

const args = process.argv.slice(2);
const packAt = args.indexOf("--pack");
const items: DailyItem[] = packAt >= 0 ? JSON.parse(readFileSync(args[packAt + 1], "utf8")).items : DAILY_ITEMS;
const until = args.find((a, i) => /^\d{4}-\d{2}-\d{2}$/.test(a) && i !== packAt + 1) ?? new Date(Date.parse(`${dateKey()}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
const byId = new Map(items.map((i) => [i.id, i]));

const file = new URL("../lib/dailySnapshot.json", import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8")) as { note: string; days: Record<string, unknown> };
const added: string[] = [];
for (const d of Object.keys(DAILY_SCHEDULE).sort()) {
  if (d > until || data.days[d]) continue;
  const day: Record<string, unknown> = {};
  for (const id of DAILY_SCHEDULE[d]) {
    const it = byId.get(id);
    if (!it) throw new Error(`${d}: ${id} not in pack`);
    day[id] = { recommendation: it.reveal.recommendation, values: it.reveal.values, best: bestCalls(it) };
  }
  data.days[d] = day;
  added.push(d);
}
writeFileSync(file, JSON.stringify(data, null, 1) + "\n");
console.log(added.length ? `snapshot: added ${added.join(", ")}` : `snapshot: up to date through ${until}`);
