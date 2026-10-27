/**
 * Fourth & Daily: 5 real 4th downs per New York (ET) calendar day, Go/Kick/Punt option
 * rules, "Close call" scoring, local streaks + stats, spoiler-free share text.
 * Day boundaries, streaks, storage and handle are carried over from PR #35 (lib/dailyQuiz.ts).
 * Items come from lib/quizPack.json (365 real nflverse plays, PR #46) until Data & Models
 * ships C6 daily/pack.json.
 */
import type { QuizChoice, QuizItem } from "./quiz";
import slimPack from "./dailyPack.json";
import dailySchedule from "./dailySchedule.json";
import dailySnapshot from "./dailySnapshot.json";

/** Daily item: the fields of a QuizItem the Daily screens use (see scripts/build-daily-pack.mjs). */
export type DailyItem = {
  id: string;
  kind: string;
  source: Pick<QuizItem["source"], "season" | "week" | "game_date" | "game_id"> & {
    /** nflverse play_id (curated ids like flip-lac-den carry no numeric suffix). */
    play_id?: number;
  };
  situation: Pick<
    QuizItem["situation"],
    "posteam" | "defteam" | "home_team" | "away_team" | "posteam_score" | "defteam_score" | "qtr" |
    "quarter_seconds_remaining" | "yardline_100" | "down" | "distance"
  > & {
    /** Timeouts left before the snap (nflverse posteam/defteam_timeouts_remaining); null hides the dots. */
    posteam_timeouts?: number | null;
    defteam_timeouts?: number | null;
  };
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

export function shuffled(items: DailyItem[], seed: string): DailyItem[] {
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
 * Committed, append-only schedule (lib/dailySchedule.json): ET date key → 5 ids. Pinned so a pack
 * rebuild that swaps ids can't reshuffle today or history (P1, UI Critic 0125 after #119). Extend it
 * with `npx tsx scripts/extend-daily-schedule.ts`; never edit or remove existing dates.
 */
export const DAILY_SCHEDULE: Record<string, string[]> = (dailySchedule as { days: Record<string, string[]> }).days;
const BY_ID = new Map(DAILY_ITEMS.map((i) => [i.id, i]));

/** Pinned ids the pack no longer has. Must be empty: a missing id fails the build (QA 0217 I). */
export function missingScheduledIds(): { date: string; id: string }[] {
  return Object.entries(DAILY_SCHEDULE).flatMap(([date, ids]) => ids.filter((id) => !BY_ID.has(id)).map((id) => ({ date, id })));
}

function resolvePinned(key: string, id: string): DailyItem {
  const item = BY_ID.get(id);
  if (!item) {
    throw new Error(`dailySchedule.json pins ${id} on ${key}, but it is not in dailyPack.json. ` +
      "Restore the item in the pack (never edit a published day) instead of reshuffling.");
  }
  return item;
}

/** Shuffle-based set (used past the schedule's end, or for a custom item list). */
export function shuffledDailySet(key: string, items: DailyItem[] = DAILY_ITEMS, size = DAILY_SET_SIZE): DailyItem[] {
  const days = cycleDays(items, size);
  if (days < 1) return items.slice(0, size);
  const n = dayNumber(key);
  const cycle = Math.floor(n / days);
  const slot = ((n % days) + days) % days;
  return shuffled(items, `daily-cycle:${cycle}`).slice(slot * size, slot * size + size);
}

/**
 * Today's 5 for an ET date key. Deterministic everywhere (same key → same set).
 * Reads the committed schedule; only dates past its end (or a custom item list) fall back to the
 * seeded per-cycle shuffle.
 */
export function dailySet(key: string, items: DailyItem[] = DAILY_ITEMS, size = DAILY_SET_SIZE): DailyItem[] {
  const pinned = items === DAILY_ITEMS ? DAILY_SCHEDULE[key] : undefined;
  if (pinned) return frozen(key, pinned.map((id) => resolvePinned(key, id)).slice(0, size));
  return items === DAILY_ITEMS ? frozen(key, shuffledDailySet(key, items, size)) : shuffledDailySet(key, items, size);
}

/** One published item's reveal, frozen for its day: the values scoring, tags and the Why read, plus best call(s). */
export type SnapshotEntry = { recommendation: string; values: Partial<Record<QuizChoice, number>>; best: QuizChoice[] };

/**
 * Append-only per-day snapshot (lib/dailySnapshot.json): ET date key → item id → reveal as published.
 * A model/pack rebuild (e.g. #122) must never regrade a day people already played; new values reach
 * only days not yet published. Append with `npx tsx scripts/snapshot-daily.ts`; never edit a date.
 * Practice and endless keep reading the live pack.
 */
export const DAILY_SNAPSHOT: Record<string, Record<string, SnapshotEntry>> =
  (dailySnapshot as unknown as { days: Record<string, Record<string, SnapshotEntry>> }).days;

function frozen(key: string, set: DailyItem[]): DailyItem[] {
  const snap = DAILY_SNAPSHOT[key];
  if (!snap) return set;
  return set.map((i) => {
    const s = snap[i.id];
    return s ? { ...i, reveal: { recommendation: s.recommendation, values: { ...s.values } } } : i;
  });
}

/** Offered option(s) whose shown % ties the top (what the reveal tags Best and scores Right). */
export function bestCalls(item: DailyItem): QuizChoice[] {
  const offered = new Set(optionStates(item).filter((o) => o.shown && !o.disabled).map((o) => o.id));
  const ranked = rankedValues(item).filter(([c]) => offered.has(c));
  if (!ranked.length) return [];
  const f = formatPercents(ranked.map(([, v]) => v));
  return ranked.filter((_, i) => f[i] === f[0]).map(([c]) => c);
}

/** Random practice round (not tied to the date). */
export function practiceSet(seed: string, items: DailyItem[] = DAILY_ITEMS, size = DAILY_SET_SIZE): DailyItem[] {
  return shuffled(items, `practice:${seed}`).slice(0, size);
}

/* ---------- Options + scoring ---------- */

export const MAX_FG_YARDS = 64;
/** "Close call" when the best two options are within 2 win-chance points. */
export const CLOSE_CALL_GAP = 0.02;

export function fieldGoalYards(item: DailyItem): number {
  return Math.round(item.situation.yardline_100 + 18);
}

export type OptionState = { id: QuizChoice; shown: boolean; disabled: boolean; note?: string };

/** Kick is disabled past 64 yards; Punt is hidden inside the opponent's 35. */
export function optionStates(item: DailyItem): OptionState[] {
  const fg = fieldGoalYards(item);
  const tooFar = fg > MAX_FG_YARDS || item.reveal.values.fg == null;
  return [
    { id: "go", shown: true, disabled: false },
    { id: "fg", shown: true, disabled: tooFar, note: tooFar ? `Too far: ${fg}-yd kick` : `${fg}-yd kick` },
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

export function rankedValues(item: DailyItem): [QuizChoice, number][] {
  return (Object.entries(item.reveal.values) as [QuizChoice, number][])
    .filter(([, v]) => typeof v === "number")
    .sort((a, b) => b[1] - a[1]);
}

/**
 * #93 scoring: the highest win chance is always Right (1). On a close call (top two within 2 pts) an
 * option within 2 pts of the top earns ½ (Close call). Anything else, or an option that isn't offered
 * (kick past 64 yd, hidden punt, no value), is 0. A pick showing the same % as the best is also Right.
 */
function shownTie(item: DailyItem, pick: QuizChoice, best: QuizChoice): boolean {
  // Same list and formatting as the reveal rows.
  const ranked = rankedValues(item);
  const f = formatPercents(ranked.map(([, v]) => v));
  const at = (c: QuizChoice) => f[ranked.findIndex(([x]) => x === c)];
  return at(pick) === at(best);
}

export function scoreCall(pick: QuizChoice, item: DailyItem): ScoredCall {
  const offered = new Set(optionStates(item).filter((o) => o.shown && !o.disabled).map((o) => o.id));
  const ranked = rankedValues(item).filter(([c]) => offered.has(c));
  const [best, bestV] = ranked[0];
  const gap = ranked.length > 1 ? bestV - ranked[1][1] : 1;
  const closeCall = gap < CLOSE_CALL_GAP;
  const mine = offered.has(pick) ? item.reveal.values[pick] : undefined;
  let result: CallResult;
  if (mine == null) result = "wrong";
  else if (pick === best) result = "right";
  // Garrett 10-27: score on the % the fan sees, so a pick that ties the best at display precision is Right.
  else if (shownTie(item, pick, best)) result = "right";
  else if (closeCall && bestV - mine < CLOSE_CALL_GAP) result = "close";
  else result = "wrong";
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

const SHARE_GLYPH: Record<CallResult, string> = { right: "🟦", wrong: "⬜", close: "½" };

export function formatScore(credit: number): string {
  return Number.isInteger(credit) ? String(credit) : credit.toFixed(1).replace(/\.0$/, "");
}

/** Shown date label, e.g. "Oct 26" from "2026-10-26". */
export function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Only squares, score and streak: no teams, plays or answers. */
export function shareText(key: string, results: CallResult[], streak: number, url: string): string {
  const credit = results.reduce((a, r) => a + (r === "right" ? 1 : r === "close" ? 0.5 : 0), 0);
  return `Fourth & Daily · ${shortDate(key)}\n${results.map((r) => SHARE_GLYPH[r]).join("")}\n${formatScore(credit)}/${results.length} · streak ${streak}\n${url}`;
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

/** Whole percents, or one decimal for all when two would round the same (QA 2220 L8). */
export function formatPercents(values: number[]): string[] {
  const r = values.map((v) => Math.round(v * 100));
  const clash = r.some((x, i) => r.indexOf(x) !== i);
  return values.map((v) => (clash ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`));
}

const DOING: Record<QuizChoice, string> = { go: "going for it", fg: "kicking", punt: "punting" };
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** #93 reveal note for a close call, from the real values; null when it wasn't close. */
export function closeNote(s: ScoredCall): string | null {
  if (!s.closeCall || s.result === "wrong") return null;
  const bestV = s.values[s.best]!;
  if (s.result === "right") {
    const near = (Object.entries(s.values) as [QuizChoice, number][])
      .filter(([c, v]) => c !== s.best && typeof v === "number" && bestV - v < CLOSE_CALL_GAP);
    if (!near.length) return null;
    const f = formatPercents([bestV, ...near.map(([, v]) => v)]).slice(1);
    return `${cap(near.map(([c]) => DOING[c]).join(" and "))} ${near.length > 1 ? "were" : "was"} about as good (${f.join(", ")}).`;
  }
  const [a, b] = formatPercents([bestV, s.values[s.pick]!]);
  // QA M13: never "0.1% vs 0.1%".
  if (a === b) return `${cap(DOING[s.best])} was about as good (both ${a}), so this pick gets ½.`;
  return `${cap(DOING[s.best])} was a little better (${a} vs ${b}), so this pick gets ½.`;
}
