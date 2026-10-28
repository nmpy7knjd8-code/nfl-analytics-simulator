import pack from "./dailyPack.json";
import retired from "./retiredDailyIds.json";

export type BallRound = {
  id: string; posteam: string; defteam: string; posScore: number; defScore: number;
  qtr: number; secs: number; down: number; distance: number; yardline100: number; action: string;
};

type PackItem = {
  id: string; kind: string; source?: { game_id: string; play_id: number };
  situation: { posteam: string; defteam: string; posteam_score: number; defteam_score: number; qtr: number; quarter_seconds_remaining: number; yardline_100: number; down: number; distance: number };
  historical_action?: string;
};

export const ROUNDS_PER_GAME = 5;
const retiredSet = new Set(retired as string[]);

/** Real plays only: historical items, not retired, regulation. */
export function eligibleRounds(items: PackItem[] = (pack as { items: PackItem[] }).items): BallRound[] {
  return items
    .filter((it) => it.kind === "historical" && it.source && !retiredSet.has(`${it.source.game_id}-${it.source.play_id}`) && it.situation.qtr <= 4)
    .map((it) => ({
      id: it.id, posteam: it.situation.posteam, defteam: it.situation.defteam,
      posScore: it.situation.posteam_score, defScore: it.situation.defteam_score,
      qtr: it.situation.qtr, secs: it.situation.quarter_seconds_remaining,
      down: it.situation.down, distance: it.situation.distance, yardline100: it.situation.yardline_100,
      action: it.historical_action ?? "",
    }));
}

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Five distinct rounds, same for everyone on a given day. */
export function roundsFor(day: string, pool = eligibleRounds()): BallRound[] {
  return [...pool].sort((a, b) => hash(day + a.id) - hash(day + b.id)).slice(0, ROUNDS_PER_GAME);
}

/** 100 minus 2 per yard off, floored at 0. */
export const roundScore = (guess: number, actual: number) => Math.max(0, 100 - 2 * Math.abs(guess - actual));

export const clampSpot = (y: number) => Math.min(99, Math.max(1, Math.round(y)));
