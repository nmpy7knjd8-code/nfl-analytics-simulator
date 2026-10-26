/**
 * Fourth & Daily: 5 real 4th downs per New York (ET) calendar day, Go/Kick/Punt option
 * rules, "Close call" scoring, local streaks + stats, spoiler-free share text.
 * Day boundaries, streaks, storage and handle are carried over from PR #35 (lib/dailyQuiz.ts).
 * Items come from lib/quizPack.json (365 real nflverse plays, PR #46) until Data & Models
 * ships C6 daily/pack.json.
 */
import type { QuizChoice, QuizItem } from "./quiz";
import slimPack from "./dailyPack.json";

/** Daily item: the fields of a QuizItem the Daily screens use (see scripts/build-daily-pack.mjs). */
export type DailyItem = {
  id: string;
  kind: string;
  source: Pick<QuizItem["source"], "season" | "week" | "game_date" | "game_id">;
  situation: Pick<
    QuizItem["situation"],
    "posteam" | "defteam" | "home_team" | "away_team" | "posteam_score" | "defteam_score" | "qtr" |
    "quarter_seconds_remaining" | "yardline_100" | "down" | "distance"
  >;
  historical_action?: string | null;
  reveal: { recommendation: string; values: Partial<Record<QuizChoice, number>> };
};

export const DAILY_ITEMS: DailyItem[] = slimPack.items as DailyItem[];

export const DAILY_SET_SIZE = 5;
export const DAILY_TIME_ZONE = "America/New_York";
export const STREAK_STORAGE_KEY = "fourth-and-daily.streak.v1";
export const HANDLE_STORAGE_KEY = "fourth-and-daily.handle.v1";

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

/** Day number since 2026-01-01 (ET date key → integer). */
export function dayNumber(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2026, 0, 1)) / 86_400_000);
}

/** Public set number: Jan 1, 2026 (ET) is Fourth & Daily #1. */
export function setNumber(key: string): number {
  return dayNumber(key) + 1;
}

function shuffled(items: DailyItem[], seed: string): DailyItem[] {
  const rand = rng(hash(seed));
  const pool = [...items].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** Days one pass through the pack lasts before any play can repeat (365 plays / 5 = 73). */
export function cycleDays(items: DailyItem[] = DAILY_ITEMS, size = DAILY_SET_SIZE): number {
  return Math.floor(items.length / size);
}

/**
 * Today's 5 for an ET date key. Deterministic everywhere (same key → same set).
 * The pack is shuffled once per cycle and dealt out 5 per day, so nothing repeats
 * inside a cycle. Brief wants no repeat within 365 days: that needs ≥1,825 plays.
 */
export function dailySet(key: string, items: DailyItem[] = DAILY_ITEMS, size = DAILY_SET_SIZE): DailyItem[] {
  const days = cycleDays(items, size);
  if (days < 1) return items.slice(0, size);
  const n = dayNumber(key);
  const cycle = Math.floor(n / days);
  const slot = ((n % days) + days) % days;
  return shuffled(items, `daily-cycle:${cycle}`).slice(slot * size, slot * size + size);
}

/** Random practice round (not tied to the date). */
export function practiceSet(seed: string, items: DailyItem[] = DAILY_ITEMS, size = DAILY_SET_SIZE): DailyItem[] {
  return shuffled(items, `practice:${seed}`).slice(0, size);
}

/* ---------- Options + scoring ---------- */

export const MAX_FG_YARDS = 64;
/** "Close call" when the best two options are within 2 win-chance points. */
export const CLOSE_CALL_GAP = 0.02;

/** Kick distance = yards to the end zone + 18 (snap ~8 yd behind the line + 10-yd end zone; nflverse-measured, engine 4fad7a9). */
export function fieldGoalYards(item: DailyItem): number {
  return Math.round(item.situation.yardline_100 + 18);
}

export const TOO_FAR_NOTE = `Too far to kick (${MAX_FG_YARDS + 1}+ yards).`;

/** True when the daily game must not offer Kick (house rule: never over 64 yd). */
export function kickTooFar(item: DailyItem): boolean {
  return fieldGoalYards(item) > MAX_FG_YARDS || item.reveal.values.fg == null;
}

export type OptionState = { id: QuizChoice; shown: boolean; disabled: boolean; note?: string };

/** Kick is hidden past 64 yards (the card shows TOO_FAR_NOTE); Punt is hidden inside the opponent's 35. */
export function optionStates(item: DailyItem): OptionState[] {
  const fg = fieldGoalYards(item);
  const tooFar = kickTooFar(item);
  return [
    { id: "go", shown: true, disabled: false },
    { id: "fg", shown: !tooFar, disabled: false, note: tooFar ? TOO_FAR_NOTE : `${fg}-yd kick` },
    { id: "punt", shown: item.situation.yardline_100 >= 35 && item.reveal.values.punt != null, disabled: false },
  ];
}

export type CallResult = "right" | "close" | "wrong";

export type ScoredCall = {
  result: CallResult;
  credit: number;
  pick: QuizChoice;
  /** Best option by the model (always the top value). */
  best: QuizChoice;
  /** Win-chance points between the best and second-best option. */
  gap: number;
  closeCall: boolean;
  values: Partial<Record<QuizChoice, number>>;
};

/** Options with an engine value, best first. Kick is left out when it's too far (it isn't offered). */
export function rankedValues(item: DailyItem): [QuizChoice, number][] {
  const far = kickTooFar(item);
  return (Object.entries(item.reveal.values) as [QuizChoice, number][])
    .filter(([id, v]) => typeof v === "number" && !(id === "fg" && far))
    .sort((a, b) => b[1] - a[1]);
}

/** Right = 1, Close call = ½ (never shown as wrong), Wrong = 0. */
export function scoreCall(pick: QuizChoice, item: DailyItem): ScoredCall {
  const ranked = rankedValues(item);
  const [best, bestV] = ranked[0];
  const gap = ranked.length > 1 ? bestV - ranked[1][1] : 1;
  const closeCall = gap < CLOSE_CALL_GAP;
  const mine = item.reveal.values[pick];
  let result: CallResult;
  if (mine == null) result = "wrong";
  else if (closeCall && bestV - mine < CLOSE_CALL_GAP) result = "close";
  else result = pick === best ? "right" : "wrong";
  return {
    result,
    credit: result === "right" ? 1 : result === "close" ? 0.5 : 0,
    pick,
    best,
    gap,
    closeCall,
    values: item.reveal.values,
  };
}

/* ---------- Streaks + stats ---------- */

export type DailyResult = {
  date: string;
  credit: number;
  answered: number;
  /** Per-situation outcomes in order (for share grid + stats). Older saves may lack it. */
  results?: CallResult[];
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
  /** distribution[k] = days with a score of k (rounded down) out of 5. */
  score_distribution: number[];
  average: number | null;
};

export function dailyStats(s: StreakState, today: string): DailyStats {
  const dist = Array.from({ length: DAILY_SET_SIZE + 1 }, () => 0);
  for (const h of s.history) dist[Math.max(0, Math.min(DAILY_SET_SIZE, Math.floor(h.credit)))]++;
  const total = s.history.reduce((a, h) => a + h.credit, 0);
  return {
    days_played: s.history.length,
    current_streak: visibleStreak(s, today),
    best_streak: s.best,
    score_distribution: dist,
    average: s.history.length ? total / s.history.length : null,
  };
}

/* ---------- Share (spoiler-free) ---------- */

/** Blue = right call, black = not the best call, small blue diamond = Close call (½). */
export const SHARE_GLYPH: Record<CallResult, string> = { right: "🟦", wrong: "⬛", close: "🔹" };

export function formatScore(credit: number): string {
  return Number.isInteger(credit) ? String(credit) : credit.toFixed(1).replace(/\.0$/, "");
}

/** Shown date label, e.g. "Oct 26" from "2026-10-26". */
export function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/**
 * Spoiler-free share: "Fourth & Daily #N · 4/5 · streak X", the squares, then the link.
 * No teams, situations, answers or themes, so friends can still play.
 */
export function shareText(key: string, results: CallResult[], streak: number, url: string): string {
  const credit = results.reduce((a, r) => a + (r === "right" ? 1 : r === "close" ? 0.5 : 0), 0);
  return `Fourth & Daily #${setNumber(key)} · ${formatScore(credit)}/${results.length} · streak ${streak}\n${results.map((r) => SHARE_GLYPH[r]).join("")}\n${url}`;
}

/** Screen-reader label for the squares, e.g. "4 of 5 right". */
export function shareLabel(results: CallResult[]): string {
  const right = results.filter((r) => r === "right").length;
  const close = results.filter((r) => r === "close").length;
  return `${right} of ${results.length} right${close ? `, ${close} close ${close === 1 ? "call" : "calls"}` : ""}`;
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
