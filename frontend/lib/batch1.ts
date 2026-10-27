/**
 * Batch 1 helpers: Coach vs. You tally, hard-mode calibration, friend challenge links, ?d= archive.
 * Pure functions; the UI keeps everything in this browser.
 */
import type { QuizChoice } from "./quiz";
import { DAILY_ITEMS, DAILY_SET_SIZE, dailySet, rankedValues, type CallResult, type DailyItem } from "./daily";

/* ---------- ?d= archive ---------- */

/** First daily set (#1). */
export const ARCHIVE_START = "2026-01-01";

/** A valid past set key from `?d=YYYY-MM-DD`, or null for today / bad / future dates. */
export function archiveKey(raw: string | null | undefined, today: string): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (raw < ARCHIVE_START || raw >= today) return null;
  return raw;
}

/* ---------- Friend challenge ---------- */

const CODE: Record<QuizChoice, string> = { go: "g", fg: "k", punt: "p" };
const DECODE: Record<string, QuizChoice> = { g: "go", k: "fg", p: "punt" };

export type Challenge = { key: string; picks: QuizChoice[] };

/** Query string for a challenge link: the set date plus your picks, e.g. "d=2026-10-26&c=gpkgp". No names, no accounts. */
export function challengeQuery(key: string, picks: QuizChoice[]): string {
  return `d=${key}&c=${picks.map((p) => CODE[p]).join("")}`;
}

/** Read a challenge from URL params; picks must cover the whole set and only offered options. */
export function readChallenge(params: URLSearchParams, today: string): Challenge | null {
  const c = params.get("c");
  const d = params.get("d");
  if (!c || !d || !/^[gkp]+$/.test(c) || c.length !== DAILY_SET_SIZE) return null;
  if (d !== today && !archiveKey(d, today)) return null;
  const items = dailySet(d);
  const picks = [...c].map((ch) => DECODE[ch]);
  if (picks.some((p, i) => !rankedValues(items[i]).some(([id]) => id === p))) return null;
  return { key: d, picks };
}

/* ---------- Coach vs. You ---------- */

export type CallLog = { id: string; pick: QuizChoice };

export type CoachTally = { calls: number; agreed: number; beat: number; agreedPct: number; beatPct: number };

const byId = new Map<string, DailyItem>();
function item(id: string): DailyItem | undefined {
  if (!byId.size) for (const it of DAILY_ITEMS) byId.set(it.id, it);
  return byId.get(id);
}

/**
 * "You agreed with coaches X% / beat them Y%": agreed = same call as the real coach;
 * beat = your call had a higher win chance than the coach's (by the model). Calls without a coach call are skipped.
 */
export function coachTally(logs: CallLog[]): CoachTally {
  let calls = 0, agreed = 0, beat = 0;
  for (const l of logs) {
    const it = item(l.id);
    const coach = it?.historical_action as QuizChoice | undefined;
    if (!it || !coach) continue;
    const vals = new Map(rankedValues(it));
    const mine = vals.get(l.pick);
    const theirs = vals.get(coach);
    calls++;
    if (l.pick === coach) agreed++;
    else if (mine != null && (theirs == null || mine > theirs)) beat++;
  }
  const pct = (n: number) => (calls ? Math.round((n / calls) * 100) : 0);
  return { calls, agreed, beat, agreedPct: pct(agreed), beatPct: pct(beat) };
}

/* ---------- Hard mode calibration ---------- */

export const CONFIDENCE_STEPS = [50, 60, 70, 80, 90, 100] as const;
export const HARD_MODE_KEY = "fourth-and-daily.hard.v1";

/**
 * Calibration score out of 100: 100 × (1 − mean squared gap between your confidence and the credit you got).
 * Saying 100% and being right scores 100; saying 100% and being wrong scores 0; 50% always scores 75.
 */
export function calibrationScore(rows: { confidence: number; result: CallResult }[]): number | null {
  if (!rows.length) return null;
  const credit = (r: CallResult) => (r === "right" ? 1 : r === "close" ? 0.5 : 0);
  const brier = rows.reduce((a, r) => a + (r.confidence / 100 - credit(r.result)) ** 2, 0) / rows.length;
  return Math.round(100 * (1 - brier));
}
