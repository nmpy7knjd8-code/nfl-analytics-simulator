/**
 * Stories lane: C2 Swing of the Week + C3 top-25 regulation swings.
 * Data: data/site/swings.json (v1, built in CI by mining/build_swings.py from nflverse pbp, #160),
 * copied to public/data/stories/swings.json and lazy-loaded; a test keeps the copy identical.
 * Fan copy never names the stat: "chance to win swung N points". No game or play ids are shown.
 */
import { gameWeekLabel } from "../playFeed";

export type Swing = {
  season: number;
  week: number;
  round: "WC" | "DIV" | "CONF" | "SB" | null;
  game_id: string;
  home: string;
  away: string;
  team: string;
  qtr: number;
  clock: string;
  down: number | null;
  togo: number | null;
  yardline_100: number | null;
  play_type: string;
  desc: string;
  wp_before: number;
  wp_after: number;
  swing: number;
};

export type SwingsDoc = { v: 1; weeks: Record<string, Swing>; top: Swing[] };

const ORD = ["", "1st", "2nd", "3rd", "4th"];

export function isSwingsDoc(x: unknown): x is SwingsDoc {
  const d = x as SwingsDoc;
  return !!d && d.v === 1 && !!d.weeks && typeof d.weeks === "object" && Array.isArray(d.top);
}

/** Regulation only: overtime never shows a win chance, so qtr 5+ rows are dropped here too. */
export function regulation(rows: Swing[]): Swing[] {
  return rows.filter((r) => r.qtr >= 1 && r.qtr <= 4 && r.game_id !== "2019_03_CIN_BUF");
}

/** nflverse play text, minus the leading clock/formation notes and jersey numbers ("5-J.Daniels" → "J.Daniels"). */
export function playText(desc: string): string {
  return desc
    .replace(/^(\s*\([^)]*\)\s*)+/, "")
    .replace(/(^|[\s(,-])\d{1,2}-(?=[A-Z])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export const points = (s: Swing): number => Math.round(Math.abs(s.swing) * 100);
export const pct = (wp: number): number => Math.round(wp * 100);

export function swingLine(s: Swing): string {
  return `Chance to win swung ${points(s)} points`;
}

export function beforeAfter(s: Swing): string {
  return `${s.team} ${pct(s.wp_before)}% → ${pct(s.wp_after)}% to win`;
}

export function situation(s: Swing): string {
  const dd = s.down && s.togo != null ? ` · ${ORD[s.down]} & ${s.togo}` : "";
  return `Q${s.qtr} · ${s.clock.replace(/^0(\d)/, "$1")}${dd} · ${s.team} ball`;
}

export function weekLabel(s: Pick<Swing, "season" | "week" | "round">): string {
  return gameWeekLabel(s.season, s.week, s.round ? "POST" : "REG");
}

export const matchup = (s: Swing): string => `${s.away} @ ${s.home}`;

/** Newest week first, so the page opens on the latest Swing of the Week. */
export function weeksNewestFirst(weeks: Record<string, Swing>): Swing[] {
  return regulation(Object.values(weeks)).sort((a, b) => b.season - a.season || b.week - a.week);
}

export function top25(rows: Swing[]): Swing[] {
  return regulation(rows).slice().sort((a, b) => Math.abs(b.swing) - Math.abs(a.swing)).slice(0, 25);
}
