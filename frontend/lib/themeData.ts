/** Committed theme files, loaded once (shared by scripts and tests). */
import { readFileSync, existsSync } from "node:fs";
import type { ThemeDay, ThemeId, ThemePack } from "../contracts/themePacks";
import type { ThemeSnapshotDay } from "./themes";

export const THEME_IDS: ThemeId[] = ["goal-line", "playoffs", "marathon"];
const read = (u: URL) => JSON.parse(readFileSync(u, "utf8"));
export const THEME_SCHEDULE_FILE = new URL("./themeSchedule.json", import.meta.url);
export const THEME_SNAPSHOT_FILE = new URL("./themeSnapshot.json", import.meta.url);
export const loadPacks = () => Object.fromEntries(THEME_IDS.map((t) =>
  [t, read(new URL(`../public/data/packs/${t}.json`, import.meta.url)) as ThemePack])) as Record<ThemeId, ThemePack>;
export const loadSchedule = () => read(THEME_SCHEDULE_FILE) as { note: string; days: Record<string, ThemeDay> };
export const loadSnapshot = () => (existsSync(THEME_SNAPSHOT_FILE) ? read(THEME_SNAPSHOT_FILE) : {
  note: "Append-only. Never edit or remove a date. Reveal values + best call(s) per themed ET day, frozen 2 days ahead by scripts/snapshot-themes.ts (same rule as dailySnapshot.json).",
  days: {},
}) as { note: string; days: Record<string, ThemeSnapshotDay> };
