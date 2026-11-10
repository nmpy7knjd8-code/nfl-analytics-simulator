/**
 * Endless play: random real 4th downs from the full pool, no limit, with a running accuracy
 * score kept in localStorage. Scored with the daily rules (scoreCall: ties at the shown % are
 * full credit, the other pick in a close call is ½).
 */
import { DAILY_ITEMS, type DailyItem, type ScoredCall } from "./daily";

export const ENDLESS_STORAGE_KEY = "fourth-and-daily.endless.v1";

export type EndlessScore = { credit: number; total: number };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const emptyEndless = (): EndlessScore => ({ credit: 0, total: 0 });

export function loadEndless(st: StorageLike | undefined): EndlessScore {
  try {
    const v = JSON.parse(st?.getItem(ENDLESS_STORAGE_KEY) ?? "null");
    if (v && Number.isFinite(v.credit) && Number.isInteger(v.total) && v.total >= 0 && v.credit >= 0 && v.credit <= v.total) {
      return { credit: v.credit, total: v.total };
    }
  } catch { /* corrupt → start fresh */ }
  return emptyEndless();
}

export function saveEndless(st: StorageLike | undefined, s: EndlessScore): void {
  try { st?.setItem(ENDLESS_STORAGE_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}

export function resetEndless(st: StorageLike | undefined): EndlessScore {
  try { st?.removeItem(ENDLESS_STORAGE_KEY); } catch { /* ignore */ }
  return emptyEndless();
}

export function addEndless(s: EndlessScore, scored: ScoredCall): EndlessScore {
  return { credit: s.credit + scored.credit, total: s.total + 1 };
}

/** "75%"; "–" before the first pick. */
export function accuracyText(s: EndlessScore): string {
  return s.total === 0 ? "–" : `${Math.round((100 * s.credit) / s.total)}%`;
}

/** "3.5 of 5": credit over total, halves kept. */
export function tallyText(s: EndlessScore): string {
  const c = Number.isInteger(s.credit) ? String(s.credit) : s.credit.toFixed(1);
  return `${c} of ${s.total}`;
}

/**
 * Next random scenario, avoiding any id in `seen` while unseen ones remain. When the pool is
 * exhausted the session starts a fresh pass (still never repeating the play just shown).
 */
export function nextEndless(seen: ReadonlySet<string>, rand: () => number = Math.random, pool: DailyItem[] = DAILY_ITEMS, last?: string): DailyItem | null {
  if (pool.length === 0) return null;
  let fresh = pool.filter((i) => !seen.has(i.id));
  if (fresh.length === 0) fresh = pool.length > 1 ? pool.filter((i) => i.id !== last) : pool;
  return fresh[Math.min(fresh.length - 1, Math.floor(rand() * fresh.length))];
}
