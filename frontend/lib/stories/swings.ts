/**
 * Stories lane: C2 Swing of the Week + C3 top-25 regulation swings.
 * Data: public/data/stories/swings.json (nflverse pbp; schema "stories-swings-v0").
 * Until mining/build_swings.py (NFL Data Builders) lands, the file is a stub built from nflverse pbp.
 * Fan copy never names the stat: "chance to win swung N points". No play ids are shipped.
 */
import { gameWeekLabel } from "../playFeed";

export type Swing = {
  game_id: string;
  season: number;
  week: number;
  season_type: string;
  game_date: string;
  home: string;
  away: string;
  final_home: number;
  final_away: number;
  qtr: number;
  clock: string;
  offense: string;
  down: number | null;
  to_go: number | null;
  text: string;
  offense_win_before: number;
  offense_win_after: number;
  swing_points: number;
  helped: string;
};

export type SwingsDoc = { schema: string; weeks: Swing[]; top25: Swing[] };

const ORD = ["", "1st", "2nd", "3rd", "4th"];

export function isSwingsDoc(x: unknown): x is SwingsDoc {
  const d = x as SwingsDoc;
  return !!d && Array.isArray(d.weeks) && Array.isArray(d.top25);
}

/** Regulation only: OT rows (qtr 5+) never show a win chance, so they are dropped here too. */
export function regulation(rows: Swing[]): Swing[] {
  return rows.filter((r) => r.qtr >= 1 && r.qtr <= 4 && r.game_id !== "2019_03_CIN_BUF");
}

/** nflverse play text without the leading clock and formation notes, e.g. "(:02) (Shotgun) ". */
export function playText(desc: string): string {
  return desc.replace(/^(\s*\([^)]*\)\s*)+/, "").trim();
}

export function swingLine(s: Swing): string {
  return `Chance to win swung ${s.swing_points} points`;
}

export function beforeAfter(s: Swing): string {
  return `${s.offense} ${s.offense_win_before}% → ${s.offense_win_after}% to win`;
}

export function situation(s: Swing): string {
  const dd = s.down && s.to_go != null ? ` · ${ORD[s.down]} & ${s.to_go}` : "";
  return `Q${s.qtr} · ${s.clock.replace(/^0(\d)/, "$1")}${dd} · ${s.offense} ball`;
}

export function weekLabel(s: Pick<Swing, "season" | "week" | "season_type">): string {
  return gameWeekLabel(s.season, s.week, s.season_type);
}

export function scoreLine(s: Swing): string {
  return `${s.away} ${s.final_away} @ ${s.home} ${s.final_home}`;
}

/** Newest week first, so the page opens on the latest Swing of the Week. */
export function weeksNewestFirst(rows: Swing[]): Swing[] {
  return regulation(rows).slice().sort((a, b) => b.season - a.season || b.week - a.week);
}

export function top25(rows: Swing[]): Swing[] {
  return regulation(rows).slice().sort((a, b) => b.swing_points - a.swing_points).slice(0, 25);
}
