/**
 * Weekly 1st-and-10 round: "Pass or run?" on five real plays. You're scored on matching
 * the real call. The reveal shows what happened plus how often passes and runs stayed
 * on schedule in similar spots (nflverse `success`, built by backend/scripts/build_firstdown.py).
 */
import pack from "./firstDownPack.json";
import { dateKey, shiftDay } from "./daily";

export type FirstDownCall = "pass" | "run";
export type Rate = { plays: number; on_schedule: number };
export type FirstDownPlay = {
  id: string; game_id: string; season: number; week: number; qtr: number; clock: string;
  yardline_100: number; posteam: string; defteam: string; home_team: string; away_team: string;
  posteam_score: number; defteam_score: number; call: FirstDownCall; on_schedule: boolean;
  result: string; desc: string; bucket: string;
};
export type FirstDownPack = {
  schema_version: "firstdown.v1"; source: string; filters: string; per_week: number; eligible_plays: number;
  league: Record<FirstDownCall, Rate>; buckets: Record<string, Partial<Record<FirstDownCall, Rate>>>; plays: FirstDownPlay[];
};

export const FIRST_DOWN_PACK = pack as FirstDownPack;
/** First Monday the round runs (week #1). */
export const LAUNCH_MONDAY = "2026-01-05";

/** ET date key of the Monday that starts the week containing `key`. */
export function weekKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return shiftDay(key, -((dow + 6) % 7));
}

export function weekNumber(monday: string): number {
  const ms = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((ms(monday) - ms(LAUNCH_MONDAY)) / (7 * 86_400_000)) + 1;
}

/** This week's five, the same for everyone; cycles after every play has been used once. */
export function weeklySet(key: string = dateKey(), p: FirstDownPack = FIRST_DOWN_PACK): FirstDownPlay[] {
  const weeks = Math.floor(p.plays.length / p.per_week);
  const n = weekNumber(weekKey(key)) - 1;
  const slot = ((n % weeks) + weeks) % weeks;
  return p.plays.slice(slot * p.per_week, slot * p.per_week + p.per_week);
}

/** Similar-spot rates for the reveal; falls back to the league rate when a bucket is thin. */
export function spotRates(play: FirstDownPlay, p: FirstDownPack = FIRST_DOWN_PACK, minPlays = 100): Record<FirstDownCall, Rate> & { similar: boolean } {
  const b = p.buckets[play.bucket];
  if (b?.pass && b?.run && b.pass.plays >= minPlays && b.run.plays >= minPlays) return { pass: b.pass, run: b.run, similar: true };
  return { ...p.league, similar: false };
}

const ZONE_TEXT: Record<string, string> = {
  own_deep: "deep in their own end", own: "on their own side", opp: "past midfield", red_zone: "in the red zone",
};
const SCORE_TEXT: Record<string, string> = { behind: "down 9+", close: "within 8", ahead: "up 9+" };

export function spotLabel(play: FirstDownPlay): string {
  const [z, s] = play.bucket.split("|");
  return `${ZONE_TEXT[z]}, ${SCORE_TEXT[s]}`;
}

export function situationText(play: FirstDownPlay): string {
  const yl = play.yardline_100;
  const spot = yl === 50 ? "midfield" : yl < 50 ? `${play.defteam} ${yl}` : `own ${100 - yl}`;
  const clock = play.clock.replace(/^0(\d:)/, "$1");
  return `${play.posteam} ${play.posteam_score} – ${play.defteam} ${play.defteam_score} · Q${play.qtr} ${clock} · 1st & 10 at ${spot}`;
}

export function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

/** Spoiler-free share. Never names teams, spots or answers. */
export function firstDownShare(monday: string, right: boolean[], url: string): string {
  const n = right.filter(Boolean).length;
  return `Fourth & Daily · First-down call, week ${weekNumber(monday)} · ${n}/${right.length}\n${right.map((r) => (r ? "🟦" : "⬛")).join("")}\n${url}`;
}

export const FD_RESULTS_KEY = "fourth-and-daily.firstdown.v1";
