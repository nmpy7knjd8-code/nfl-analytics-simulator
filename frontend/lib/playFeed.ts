/**
 * C6 Play feed: every play of one game with its win chance, filter chips and a tap-to-chart view.
 * Pure helpers over the live game file (/data/games/<id>.json, game.v2/games-v3); the component only renders.
 */
import type { GameFileV2 } from "./gameFileV2";

const NON_PLAY = /^(GAME|END (QUARTER \d|GAME)|Two-Minute Warning|Timeout #\d)/i;
const ORD = ["", "1st", "2nd", "3rd", "4th"];

export type FeedPlay = {
  id: string;
  qtr: number;
  /** Seconds left in the period. */
  sec: number | null;
  /** Game seconds elapsed at the snap (x axis of the chart). */
  t: number;
  team: string | null;
  down: number | null;
  dist: number | null;
  text: string;
  penalty: string | null;
  /** Home team's win chance after the play (0..1). */
  homeWp: number;
  /** Home win chance just before the snap. */
  homeWpBefore: number;
  big: boolean;
  scoring: boolean;
  fourth: boolean;
  homeScore: number;
  awayScore: number;
  /** Overtime play: house rule, no win chance shown (matches winProbability.ts), no chart. */
  ot: boolean;
};

export type FeedGame = { id: string; home: string; away: string; season: number; week: number; homeScore: number; awayScore: number; plays: FeedPlay[] };

export type KindFilter = "big" | "fourth" | "scoring";
export type FeedFilter = { team: string | null; qtr: number | null; kind: KindFilter | null };
export const NO_FILTER: FeedFilter = { team: null, qtr: null, kind: null };

export const KIND_LABEL: Record<KindFilter, string> = { big: "Big plays", fourth: "4th downs", scoring: "Scoring" };

export function elapsed(qtr: number, sec: number | null): number {
  const s = sec ?? 0;
  return qtr <= 4 ? (qtr - 1) * 900 + (900 - s) : 3600 + (600 - Math.min(600, s));
}

export function buildFeed(doc: GameFileV2): FeedGame {
  const c = doc.cols;
  const n = c.play_id.length;
  const swings = new Set(doc.swing_play_ids);
  const wpAt = (i: number): number => {
    for (let j = i; j < n; j++) if (c.home_wp[j] != null) return c.home_wp[j] as number;
    return doc.final_home_wp ?? 0.5;
  };
  const plays: FeedPlay[] = [];
  for (let i = 0; i < n; i++) {
    if (c.play_type[i] == null || NON_PLAY.test(c.text[i] ?? "")) continue;
    const text = (c.display_text?.[i] || c.text[i] || "").trim();
    if (!text) continue;
    const before = c.home_wp[i] ?? wpAt(i);
    const after = i + 1 < n ? wpAt(i + 1) : doc.final_home_wp ?? before;
    // game.v2 score columns are the score after the play on that row.
    const home = c.home_score[i] ?? 0;
    const away = c.away_score[i] ?? 0;
    const prevHome = i ? c.home_score[i - 1] ?? 0 : 0;
    const prevAway = i ? c.away_score[i - 1] ?? 0 : 0;
    plays.push({
      id: String(c.play_id[i]), qtr: c.qtr[i], sec: c.sec[i], t: elapsed(c.qtr[i], c.sec[i]), team: c.posteam[i],
      down: c.down[i], dist: c.ydstogo[i], text, penalty: c.penalty_text?.[i] ?? null,
      homeWp: after, homeWpBefore: before, big: c.qtr[i] <= 4 && swings.has(c.play_id[i]),
      scoring: home !== prevHome || away !== prevAway,
      fourth: c.down[i] === 4 && c.play_type[i] !== "no_play",
      homeScore: home, awayScore: away, ot: c.qtr[i] > 4,
    });
  }
  const g = doc.game as Record<string, unknown>;
  return {
    id: doc.game.id, home: doc.game.home, away: doc.game.away, season: Number(g.season), week: Number(g.week),
    homeScore: Number(g.home_score ?? 0), awayScore: Number(g.away_score ?? 0), plays,
  };
}

export function filterFeed(plays: FeedPlay[], f: FeedFilter): FeedPlay[] {
  return plays.filter(
    (p) => (f.team == null || p.team === f.team) && (f.qtr == null || (f.qtr === 5 ? p.qtr > 4 : p.qtr === f.qtr)) && (f.kind == null || p[f.kind]),
  );
}

/** Tapping an active chip clears it; tapping another chip in the same group swaps it. */
export function toggle<K extends keyof FeedFilter>(f: FeedFilter, key: K, value: FeedFilter[K]): FeedFilter {
  return { ...f, [key]: f[key] === value ? null : value };
}

export function clockText(sec: number | null): string {
  if (sec == null) return "";
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function metaLine(p: FeedPlay): string {
  const q = p.qtr > 4 ? "OT" : `Q${p.qtr}`;
  const parts = [q, clockText(p.sec)];
  if (p.down && p.dist != null) parts.push(`${ORD[p.down]} & ${p.dist}`);
  if (p.team) parts.push(`${p.team} ball`);
  return parts.filter(Boolean).join(" · ");
}

/** Plain win-chance words for whichever team is ahead after the play, e.g. "KC 62% to win". */
export function winLine(g: Pick<FeedGame, "home" | "away">, wp: number): { team: string; pct: number } {
  const home = Math.round(wp * 100);
  return home >= 50 ? { team: g.home, pct: home } : { team: g.away, pct: 100 - home };
}

/** Change in that team's chance on this play, in whole points, with a sign. */
export function swingText(g: Pick<FeedGame, "home" | "away">, p: FeedPlay): string {
  const lead = winLine(g, p.homeWp);
  const sign = lead.team === g.home ? 1 : -1;
  const d = Math.round(p.homeWp * 100) - Math.round(p.homeWpBefore * 100);
  const v = d * sign;
  return v === 0 ? "No change" : `${lead.team} ${v > 0 ? "up" : "down"} ${Math.abs(v)} points on this play`;
}

/** Points for the chart: start of game, then each play's chance after it. */
/** Regulation only: overtime plays never appear on the chart (house rule). */
export function chartPoints(plays: FeedPlay[]): { t: number; wp: number; id: string | null }[] {
  const reg = plays.filter((p) => !p.ot);
  if (!reg.length) return [];
  return [{ t: 0, wp: reg[0].homeWpBefore, id: null }, ...reg.map((p) => ({ t: p.t, wp: p.homeWp, id: p.id }))];
}

/** Rows that can open the chart: regulation plays only. */
export function canChart(p: FeedPlay): boolean {
  return !p.ot;
}
