/**
 * Themed bonus sets (B6 packs, B3 rules). Shapes: contracts/themePacks.ts.
 * Pure scheduling logic; scripts/extend-theme-schedule.ts writes lib/themeSchedule.json.
 */
import type { ThemeDay, ThemeId, ThemeRules } from "../contracts/themePacks";

const nextDay = (key: string) => new Date(Date.parse(`${key}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
/** Stable order: FNV-1a of the id, so a set mixes games instead of walking one game's plays. */
const fnv = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; };
const packOrder = (ids: string[]) => [...ids].sort((a, b) => fnv(a) - fnv(b) || a.localeCompare(b));
const weekday = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

/** First date a theme may be scheduled on: the day after the later of the last snapshot (published) day and today + 2. */
export function firstThemeDate(snapshotDates: string[], today: string): string {
  const lastSnap = [...snapshotDates].sort().at(-1) ?? today;
  const todayPlus2 = nextDay(nextDay(today));
  return nextDay(lastSnap > todayPlus2 ? lastSnap : todayPlus2);
}

/**
 * Append-only: returns `existing` plus new dates from max(firstDate, day after the last existing date)
 * through `until`. Existing dates are never changed. Each theme walks its pack in a stable hashed id order,
 * continuing where its last scheduled set stopped, so no play repeats until the pack is used up.
 */
export function extendThemeSchedule(
  rules: ThemeRules,
  packIds: Record<ThemeId, string[]>,
  existing: Record<string, ThemeDay>,
  firstDate: string,
  until: string,
): Record<string, ThemeDay> {
  const out: Record<string, ThemeDay> = { ...existing };
  const dates = Object.keys(existing).sort();
  const lastExisting = dates.at(-1);
  let key = lastExisting && nextDay(lastExisting) > firstDate ? nextDay(lastExisting) : firstDate;
  const cursor = new Map<ThemeId, number>();
  for (const d of dates) {
    const { theme, ids } = existing[d];
    const order = packOrder(packIds[theme]);
    const at = order.indexOf(ids[ids.length - 1]);
    if (at >= 0) cursor.set(theme, at + 1);
  }
  for (; key <= until; key = nextDay(key)) {
    const rule = rules.rules.find((r) => r.weekday === weekday(key));
    if (!rule) continue;
    const order = packOrder(packIds[rule.theme]);
    if (order.length < rules.setSize) throw new Error(`${rule.theme} pack has only ${order.length} items`);
    let at = cursor.get(rule.theme) ?? 0;
    const ids: string[] = [];
    while (ids.length < rules.setSize) ids.push(order[at++ % order.length]);
    cursor.set(rule.theme, at % order.length);
    out[key] = { theme: rule.theme, ids };
  }
  return out;
}
