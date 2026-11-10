// Fails the build if lib/themeSchedule.json pins an id missing from its pack, or a frozen/published
// themed day changed (lib/themeSnapshot.json is the record of what was frozen). Add-only.
import { dateKey } from "../lib/daily";
import { themeScheduleIssues } from "../lib/themes";
import { THEME_IDS, loadPacks, loadSchedule, loadSnapshot } from "../lib/themeData";

const packs = loadPacks();
const issues = themeScheduleIssues(loadSchedule().days,
  Object.fromEntries(THEME_IDS.map((t) => [t, packs[t].items.map((i) => i.id)])) as never, loadSnapshot().days, dateKey());
if (issues.length) {
  console.error(`themeSchedule.json: ${issues.length} problem(s):`);
  for (const i of issues) console.error(`  ${i}`);
  console.error("Never edit a frozen or published themed day; only add new dates (scripts/extend-theme-schedule.ts).");
  process.exit(1);
}
console.log("themeSchedule.json: every id resolves; frozen days unchanged");
