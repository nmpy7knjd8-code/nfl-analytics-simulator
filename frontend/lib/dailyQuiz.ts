/**
 * Daily fourth-down quiz: one deterministic set per calendar date, local streaks,
 * and a leaderboard view model typed for a future API.
 * Pure helpers only (storage access is isolated in `loadStreak` / `saveStreak`).
 */
import { QUIZ_ITEMS, type QuizItem } from "./quiz";

export const DAILY_SET_SIZE = 3;
export const STREAK_STORAGE_KEY = "nfl-sim.daily-quiz.streak.v1";

/** Local calendar date as YYYY-MM-DD (the user's day, not UTC). */
export function dateKey(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** FNV-1a 32-bit hash: stable across browsers and Node. */
function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Mulberry32 seeded PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same date + same pack → same set, in the same order. */
export function dailySet(
  key: string,
  items: QuizItem[] = QUIZ_ITEMS,
  size = DAILY_SET_SIZE,
): QuizItem[] {
  const rand = rng(hash(`daily:${key}`));
  const pool = [...items].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(size, pool.length));
}

export type DailyResult = { date: string; credit: number; answered: number };

export type StreakState = {
  /** Consecutive days with a finished daily set, ending at last_completed. */
  current: number;
  best: number;
  last_completed: string | null;
  history: DailyResult[];
};

export function emptyStreak(): StreakState {
  return { current: 0, best: 0, last_completed: null, history: [] };
}

function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Record finishing today's set. Replaying the same day does not double-count. */
export function recordDaily(prev: StreakState, result: DailyResult): StreakState {
  if (prev.last_completed === result.date) return prev;
  const gap = prev.last_completed ? dayDiff(prev.last_completed, result.date) : null;
  if (gap != null && gap < 0) return prev; // clock went backwards; ignore
  const current = gap === 1 ? prev.current + 1 : 1;
  return {
    current,
    best: Math.max(prev.best, current),
    last_completed: result.date,
    history: [...prev.history, result].slice(-60),
  };
}

/** Streak as shown today: drops to 0 if a day was missed. */
export function visibleStreak(s: StreakState, today: string): number {
  if (!s.last_completed) return 0;
  return dayDiff(s.last_completed, today) <= 1 ? s.current : 0;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadStreak(storage: StorageLike | undefined): StreakState {
  try {
    const raw = storage?.getItem(STREAK_STORAGE_KEY);
    if (!raw) return emptyStreak();
    const v = JSON.parse(raw) as Partial<StreakState>;
    if (typeof v.current !== "number" || typeof v.best !== "number") return emptyStreak();
    return {
      current: v.current,
      best: v.best,
      last_completed: v.last_completed ?? null,
      history: Array.isArray(v.history) ? v.history : [],
    };
  } catch {
    return emptyStreak();
  }
}

export function saveStreak(storage: StorageLike | undefined, s: StreakState): void {
  try {
    storage?.setItem(STREAK_STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* storage full or blocked — streak just won't persist */
  }
}

/* ---------- Leaderboard (future API shape) ---------- */

export type LeaderboardEntry = {
  rank: number;
  display_name: string;
  /** Sum of credit over the period (correct = 1, near-tie = 0.5). */
  points: number;
  current_streak: number;
  is_you?: boolean;
};

export type LeaderboardResponse = {
  period: "daily" | "all_time";
  date: string;
  entries: LeaderboardEntry[];
  /** "example" = fixture, never real players. */
  source: "example" | "live";
  source_note: string;
};

/** Insert the local player and re-rank by points, then streak, then name. */
export function withYou(
  board: LeaderboardResponse,
  you: { points: number; current_streak: number } | null,
): LeaderboardResponse {
  const rows = board.entries.filter((e) => !e.is_you).map((e) => ({ ...e }));
  if (you) rows.push({ rank: 0, display_name: "You", ...you, is_you: true });
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.current_streak - a.current_streak ||
      a.display_name.localeCompare(b.display_name),
  );
  rows.forEach((r, i) => (r.rank = i + 1));
  return { ...board, entries: rows };
}
