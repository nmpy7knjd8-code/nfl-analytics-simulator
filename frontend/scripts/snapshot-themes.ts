/**
 * Append-only writer for lib/themeSnapshot.json: freezes each themed day's reveal values and best call(s)
 * through <date> (default: today ET + 2 days), like scripts/snapshot-daily.ts. Existing dates never change.
 * Usage: npx tsx scripts/snapshot-themes.ts [YYYY-MM-DD]
 */
import { writeFileSync } from "node:fs";
import { bestCalls, dateKey, type DailyItem } from "../lib/daily";
import { snapshotThemes } from "../lib/themes";
import { THEME_IDS, THEME_SNAPSHOT_FILE, loadPacks, loadSchedule, loadSnapshot } from "../lib/themeData";

const until = process.argv.slice(2).find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a)) ??
  new Date(Date.parse(`${dateKey()}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10);
const packs = loadPacks();
const snap = loadSnapshot();
const { days, added } = snapshotThemes(loadSchedule().days,
  Object.fromEntries(THEME_IDS.map((t) => [t, packs[t].items])) as never, snap.days, until,
  (it) => bestCalls(it as unknown as DailyItem));
writeFileSync(THEME_SNAPSHOT_FILE, JSON.stringify({ note: snap.note, days }, null, 1) + "\n");
console.log(added.length ? `theme snapshot: added ${added.join(", ")}` : `theme snapshot: up to date through ${until}`);
