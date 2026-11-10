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

/** Frozen reveal of one themed item (same as a daily SnapshotEntry). */
export type ThemeSnapshotEntry = { recommendation: string; values: Record<string, number>; best: string[] };
export type ThemeSnapshotDay = { theme: ThemeId; items: Record<string, ThemeSnapshotEntry> };

type PackItemLike = { id: string; reveal: { recommendation: string; values: Record<string, number> } };

/**
 * Append-only freeze (lib/themeSnapshot.json), same rule as scripts/snapshot-daily.ts: every scheduled
 * themed date <= `until` that has no entry yet is frozen from the current packs. Existing dates never change.
 */
export function snapshotThemes(
  schedule: Record<string, ThemeDay>,
  packs: Record<ThemeId, PackItemLike[]>,
  existing: Record<string, ThemeSnapshotDay>,
  until: string,
  best: (item: PackItemLike) => string[],
): { days: Record<string, ThemeSnapshotDay>; added: string[] } {
  const days = { ...existing };
  const added: string[] = [];
  for (const d of Object.keys(schedule).sort()) {
    if (d > until || days[d]) continue;
    const { theme, ids } = schedule[d];
    const byId = new Map(packs[theme].map((i) => [i.id, i]));
    const items: Record<string, ThemeSnapshotEntry> = {};
    for (const id of ids) {
      const it = byId.get(id);
      if (!it) throw new Error(`${d}: ${id} not in ${theme} pack`);
      items[id] = { recommendation: it.reveal.recommendation, values: { ...it.reveal.values }, best: best(it) };
    }
    days[d] = { theme, items };
    added.push(d);
  }
  return { days, added };
}

/**
 * Problems that must fail the build: a scheduled id missing from its pack; a frozen (snapshotted) date
 * whose theme or ids changed or vanished from the schedule; a published date (<= today) not frozen.
 */
export function themeScheduleIssues(
  schedule: Record<string, ThemeDay>,
  packIds: Record<ThemeId, string[]>,
  snapshot: Record<string, ThemeSnapshotDay>,
  today: string,
): string[] {
  const issues: string[] = [];
  for (const [d, { theme, ids }] of Object.entries(schedule)) {
    const have = new Set(packIds[theme] ?? []);
    for (const id of ids) if (!have.has(id)) issues.push(`${d}: ${id} missing from ${theme} pack`);
    if (d <= today && !snapshot[d]) issues.push(`${d}: published themed day is not frozen in themeSnapshot.json`);
  }
  for (const [d, snap] of Object.entries(snapshot)) {
    const s = schedule[d];
    if (!s) issues.push(`${d}: frozen themed day was removed from themeSchedule.json`);
    else if (s.theme !== snap.theme || JSON.stringify(s.ids) !== JSON.stringify(Object.keys(snap.items)))
      issues.push(`${d}: frozen themed day changed (was ${snap.theme} ${Object.keys(snap.items).join(",")})`);
  }
  return issues;
}
