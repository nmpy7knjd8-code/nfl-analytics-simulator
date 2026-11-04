/** Game Story page helpers (Stories lane). Reads the live game file /data/games/<id>.json via expandGameV2. */
import { expandGameV2, type GameFileV2 } from "../gameFileV2";
import { gameWeekLabel } from "../playFeed";
import { sentence, storyRows, type NarrRow } from "./narrator";

export type StoryGame = { id: string; season: number; week: number; seasonType: string; home: string; away: string; homeScore: number; awayScore: number; overtime: boolean };
export type StoryBeat = { playId: number; qtr: number; clock: string; team: string; sentence: string; text: string };
export type StoryPoint = { t: number; wp: number };
export type Story = { game: StoryGame; beats: StoryBeat[]; points: StoryPoint[]; rows: Map<number, StoryBeat> };

const NON_PLAY = /^(GAME|END (QUARTER \d|GAME)|Two-Minute Warning|Timeout #\d)/i;

/** Play text without leading clock/formation notes or jersey numbers. */
export function playText(desc: string): string {
  return desc.replace(/^(\s*\([^)]*\)\s*)+/, "").replace(/(^|[\s([,-])\d{1,2}-(?=[A-Z])/g, "$1").replace(/\s+/g, " ").trim();
}

export function storyHref(gameId: string, playId?: number | null, basePath = ""): string {
  return `${basePath}/story/?game=${encodeURIComponent(gameId)}${playId != null ? `#play-${playId}` : ""}`;
}

export function gameIdFromQuery(search: string): string | null {
  const g = new URLSearchParams(search).get("game");
  return g && /^20\d\d_\d\d_[A-Z]{2,3}_[A-Z]{2,3}$/.test(g) ? g : null;
}

export function playIdFromHash(hash: string): number | null {
  const m = /^#play-(\d+)$/.exec(hash);
  return m ? Number(m[1]) : null;
}

export function weekLine(g: StoryGame): string {
  return gameWeekLabel(g.season, g.week, g.seasonType);
}

export function buildStory(doc: GameFileV2): Story {
  const v1 = expandGameV2(doc);
  const gm = doc.game as Record<string, unknown>;
  const game: StoryGame = {
    id: doc.game.id, season: Number(gm.season), week: Number(gm.week), seasonType: String(gm.season_type ?? "REG"),
    home: doc.game.home, away: doc.game.away, homeScore: Number(gm.home_score), awayScore: Number(gm.away_score), overtime: !!gm.overtime,
  };
  const plays = v1.plays.filter((p) => !NON_PLAY.test(p.text ?? "")) as unknown as (NarrRow & { display_text?: string })[];
  const toBeat = (p: NarrRow & { display_text?: string }): StoryBeat => ({
    playId: p.play_id, qtr: p.qtr, clock: p.clock ?? "", team: p.posteam ?? "",
    sentence: sentence(p, game.home, game.away), text: playText(p.display_text ?? p.text),
  });
  const beats = storyRows(plays).map(toBeat);
  const rows = new Map(plays.map((p) => [p.play_id, toBeat(p)]));
  // Regulation only: overtime has no win chance, so no OT points on the chart.
  const points = plays
    .filter((p) => p.qtr <= 4 && p.home_wp != null && p.clock)
    .map((p) => { const [m, s] = p.clock!.split(":").map(Number); return { t: (p.qtr - 1) * 900 + 900 - (m * 60 + s), wp: p.home_wp as number }; });
  return { game, beats, points, rows };
}
