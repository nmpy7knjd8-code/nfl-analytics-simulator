/** G4 On this day: real nflverse final scores played on today's month-day (onthisday/v1, US Eastern dates). */
export type OnThisDayDoc = { schema: "onthisday/v1"; cols: string[]; days: Record<string, unknown[][]>; fallback: Record<string, number> };
export type DayGame = { gameId: string; year: number; away: string; home: string; awayScore: number; homeScore: number; ot: boolean };

import { currentTeam as team } from "../teamCodes";

export function isOnThisDayDoc(x: unknown): x is OnThisDayDoc {
  const d = x as OnThisDayDoc;
  return !!d && d.schema === "onthisday/v1" && !!d.days && typeof d.days === "object" && !!d.fallback && Array.isArray(d.cols);
}

export const mmdd = (dt: Date): string => `${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;

/** Key to show for `key`: itself if it has games, else the fallback offset (nearest football day), else null. */
export function pickDay(d: OnThisDayDoc, key: string): { key: string; exact: boolean } | null {
  if (d.days[key]?.length) return { key, exact: true };
  const off = d.fallback[key];
  if (off == null) return null;
  const [m, day] = key.split("-").map(Number);
  const t = new Date(Date.UTC(2024, m - 1, day + off));
  const k = `${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
  return d.days[k]?.length ? { key: k, exact: false } : null;
}

export function games(d: OnThisDayDoc, key: string): DayGame[] {
  const i = (c: string) => d.cols.indexOf(c);
  return (d.days[key] ?? []).map((r) => {
    const id = r[i("game_id")] as string;
    const p = id.split("_");
    const o = i("ot"); // QA C4: Data Builders' optional overtime flag; files without the column read as regulation
    return { gameId: id, year: r[i("year")] as number, away: team(p[2]), home: team(p[3]), awayScore: r[i("away_score")] as number, homeScore: r[i("home_score")] as number, ot: o >= 0 && !!r[o] };
  }).sort((a, b) => b.year - a.year || Math.abs(a.awayScore - a.homeScore) - Math.abs(b.awayScore - b.homeScore));
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const dayLabel = (key: string): string => { const [m, d] = key.split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };
export const scoreLine = (g: DayGame): string => `${g.away} ${g.awayScore}, ${g.home} ${g.homeScore}${g.ot ? " (OT)" : ""}`;

/** When the list is capped, keep overtime games in the shown set (C5). Uncapped returns every game in the existing year-then-margin order. */
export function shownGames(list: DayGame[], max?: number): DayGame[] {
  if (max == null || !Number.isFinite(max) || max <= 0 || list.length <= max) return list.slice();
  const head = list.slice(0, max);
  const missingOt = list.filter((g) => g.ot && !head.includes(g));
  if (!missingOt.length) return head;
  const drop = new Set<DayGame>();
  for (let i = head.length - 1; i >= 0 && drop.size < missingOt.length; i--) {
    if (!head[i].ot) drop.add(head[i]);
  }
  return list.filter((g) => (head.includes(g) && !drop.has(g)) || missingOt.includes(g)).slice(0, max);
}

/** "Here are all 25." or "Here are 5 of 25." */
export function listLabel(shown: number, total: number): string {
  if (shown >= total) return `Here are all ${total}.`;
  return `Here are ${shown} of ${total}.`;
}
