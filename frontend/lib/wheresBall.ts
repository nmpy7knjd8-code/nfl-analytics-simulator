import pack from "./dailyPack.json";
import retired from "./retiredDailyIds.json";
import { dailySet, dateKey } from "./daily";

export type BallRound = {
  /** Pack item id. */ id: string;
  /** nflverse "game_id-play_id", the id the daily schedule and retired list use. */ playKey: string; posteam: string; defteam: string; posScore: number; defScore: number;
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
      id: it.id, playKey: `${it.source!.game_id}-${it.source!.play_id}`, posteam: it.situation.posteam, defteam: it.situation.defteam,
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

/** Ids of that date's Fourth & Daily plays (both id forms), so this game never repeats them. */
export function dailyIdsFor(day: string): Set<string> {
  const ids = new Set<string>();
  for (const it of dailySet(day)) {
    ids.add(it.id);
    if (it.source.play_id !== undefined) ids.add(`${it.source.game_id}-${it.source.play_id}`);
  }
  return ids;
}

/**
 * Five distinct rounds for an ET date key: the eligible pool minus that date's daily plays,
 * ordered by a hash salted "wheres-ball:" so it is independent of the daily shuffle.
 * Does not touch the daily schedule.
 */
export function roundsFor(day: string = dateKey(), pool = eligibleRounds()): BallRound[] {
  const daily = dailyIdsFor(day);
  return pool
    .filter((r) => !daily.has(r.id) && !daily.has(r.playKey))
    .sort((a, b) => hash(`wheres-ball:${day}:${a.id}`) - hash(`wheres-ball:${day}:${b.id}`) || (a.id < b.id ? -1 : 1))
    .slice(0, ROUNDS_PER_GAME);
}

/** 100 minus 2 per yard off, floored at 0. */
export const roundScore = (guess: number, actual: number) => Math.max(0, 100 - 2 * Math.abs(guess - actual));

export const clampSpot = (y: number) => Math.min(99, Math.max(1, Math.round(y)));
