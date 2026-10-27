// Fails the build if any pinned daily id is missing from lib/dailyPack.json (QA 0217 I).
// A missing id must never silently fall back to a reshuffle of a published day.
import { missingScheduledIds } from "../lib/daily";

const missing = missingScheduledIds();
if (missing.length) {
  console.error(`dailySchedule.json pins ${missing.length} id(s) missing from dailyPack.json:`);
  for (const m of missing) console.error(`  ${m.date}: ${m.id}`);
  console.error("Put the items back in the pack (or retire them only from unpublished dates).");
  process.exit(1);
}
console.log("dailySchedule.json: every pinned id resolves");
