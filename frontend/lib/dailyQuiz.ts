/**
 * Daily fourth-down quiz: one deterministic set per New York calendar date, local
 * streaks + stats, an anonymous local handle, share text, and a leaderboard client
 * typed for a PROPOSED API (see lib/leaderboardApi.ts).
 * Scoring stays in lib/quiz.ts; this file only orchestrates days.
 */
import { QUIZ_ITEMS, type QuizItem, type QuizResult } from "./quiz";

export const DAILY_SET_SIZE = 3;
export const DAILY_TIME_ZONE = "America/New_York";
export const STREAK_STORAGE_KEY = "nfl-sim.daily-quiz.streak.v1";
export const HANDLE_STORAGE_KEY = "nfl-sim.daily-quiz.handle.v1";

/* ---------- Day boundaries (America/New_York) ---------- */

function nyParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: DAILY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

/** The quiz day (YYYY-MM-DD) as of `d`: rolls over at midnight New York time for everyone. */
export function dateKey(d: Date = new Date()): string {
  const p = nyParts(d);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Milliseconds until the next New York midnight (DST-safe: searches for the key change). */
export function msUntilNextSet(now: Date = new Date()): number {
  const p = nyParts(now);
  const intoDay = ((p.h * 60 + p.min) * 60 + p.s) * 1000 + now.getMilliseconds();
  // First guess assumes a 24h day; adjust ±1h for DST transition days.
  let guess = 86_400_000 - intoDay;
  const today = dateKey(now);
  for (const adj of [0, -3_600_000, 3_600_000]) {
    const t = guess + adj;
    if (dateKey(new Date(now.getTime() + t)) !== today && dateKey(new Date(now.getTime() + t - 1000)) === today) {
      return t;
    }
  }
  return guess;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/* ---------- Deterministic daily set ---------- */

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

/* ---------- Streaks + stats ---------- */

export type DailyResult = {
  date: string;
  credit: number;
  answered: number;
  /** Per-situation outcomes in order (for share grid + stats). Older saves may lack it. */
  results?: QuizResult[];
};

export type StreakState = {
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

/** Record finishing a day's set. Replaying the same day does not double-count. */
export function recordDaily(prev: StreakState, result: DailyResult): StreakState {
  if (prev.last_completed === result.date) return prev;
  const gap = prev.last_completed ? dayDiff(prev.last_completed, result.date) : null;
  if (gap != null && gap < 0) return prev;
  const current = gap === 1 ? prev.current + 1 : 1;
  return {
    current,
    best: Math.max(prev.best, current),
    last_completed: result.date,
    history: [...prev.history, result].slice(-365),
  };
}

/** Streak as shown today: drops to 0 if a day was missed. */
export function visibleStreak(s: StreakState, today: string): number {
  if (!s.last_completed) return 0;
  return dayDiff(s.last_completed, today) <= 1 ? s.current : 0;
}

export type DailyStats = {
  days_played: number;
  current_streak: number;
  best_streak: number;
  /** distribution[k] = days with exactly k right calls (0..DAILY_SET_SIZE). */
  right_call_distribution: number[];
};

export function dailyStats(s: StreakState, today: string): DailyStats {
  const dist = Array.from({ length: DAILY_SET_SIZE + 1 }, () => 0);
  for (const h of s.history) {
    if (!h.results) continue;
    const k = h.results.filter((r) => r === "correct").length;
    dist[Math.min(k, DAILY_SET_SIZE)]++;
  }
  return {
    days_played: s.history.length,
    current_streak: visibleStreak(s, today),
    best_streak: s.best,
    right_call_distribution: dist,
  };
}

/* ---------- Share (spoiler-free) ---------- */

const SHARE_GLYPH: Record<QuizResult, string> = { correct: "🟦", incorrect: "⬜", near_tie: "½" };

export function shareText(date: string, results: QuizResult[], url: string): string {
  const right = results.filter((r) => r === "correct").length;
  return `4th Down Daily ${date} — ${right}/${results.length}\n${results.map((r) => SHARE_GLYPH[r]).join("")}\n${url}`;
}

/* ---------- Storage ---------- */

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
    /* storage blocked — streak just won't persist */
  }
}

const HANDLE_WORDS = ["Blitz", "Audible", "Redzone", "Hashmark", "Pylon", "Shotgun", "Nickel", "Gunner", "Sideline", "Chainmover"];

/** Anonymous local handle like "Pylon-4821". Created once, stored locally, no sign-in. */
export function getOrCreateHandle(storage: StorageLike | undefined, rand: () => number = Math.random): string {
  try {
    const existing = storage?.getItem(HANDLE_STORAGE_KEY);
    if (existing && /^[A-Za-z]+-\d{4}$/.test(existing)) return existing;
  } catch {
    /* fall through */
  }
  const word = HANDLE_WORDS[Math.floor(rand() * HANDLE_WORDS.length)];
  const handle = `${word}-${String(Math.floor(rand() * 10000)).padStart(4, "0")}`;
  try {
    storage?.setItem(HANDLE_STORAGE_KEY, handle);
  } catch {
    /* not persisted */
  }
  return handle;
}
