/**
 * F3 "All plays / Close games" toggle data (lib/teamGarbageTime.json, PR #186, built from nflverse play-by-play).
 * Rows hold raw counts plus a rank; rates are computed here. Ranks and league totals are separate per view and season.
 * Close = regulation snap with the result still in doubt (nflverse 10–90% before the snap). Overtime is never close.
 */
import raw from "./teamGarbageTime.json";

export type View = "all" | "close";
export type Triple = [number, number, number];
export type GtLeague = { rz: Triple; ypp: Triple; third: Triple };
export type GtRow = { team: string; rz: Triple; ypp: Triple; third: Triple };
export type GtView = { league: GtLeague; teams: GtRow[] };
export type GtFile = {
  schema_version: number; stub: boolean; source: string; season_type: string;
  season_list: number[]; close_def: string; stats: unknown;
  all: GtView; close: GtView; by_season: Record<string, { all: GtView; close: GtView }>;
};

export const GT = raw as unknown as GtFile;
if (GT.stub) throw new Error("teamGarbageTime.json is a stub; real data only");

export const VIEW_LABEL: Record<View, string> = { all: "All plays", close: "Close games" };
export const CLOSE_LINE = "Close games: plays while the result was still in doubt. Overtime not included.";

export function gtView(view: View, season: string, f: GtFile = GT): GtView | undefined {
  return season === "all" ? f[view] : f.by_season[season]?.[view];
}

export type TeamStats = {
  rz: { trips: number; td: number; rate: number; rank: number; league: number };
  ypp: { plays: number; yards: number; rate: number; rank: number; league: number };
  third: { att: number; conv: number; rate: number; rank: number; league: number };
  teams: number;
};

export function teamStats(abbr: string, v: GtView): TeamStats | undefined {
  const r = v.teams.find((t) => t.team === abbr);
  if (!r) return undefined;
  const L = v.league;
  return {
    rz: { trips: r.rz[0], td: r.rz[1], rate: r.rz[1] / r.rz[0], rank: r.rz[2], league: L.rz[1] / L.rz[0] },
    ypp: { plays: r.ypp[0], yards: r.ypp[1], rate: r.ypp[1] / r.ypp[0], rank: r.ypp[2], league: L.ypp[1] / L.ypp[0] },
    third: { att: r.third[0], conv: r.third[1], rate: r.third[1] / r.third[0], rank: r.third[2], league: L.third[1] / L.third[0] },
    teams: v.teams.length,
  };
}

/** "0.3 yards more than the league" / "0.1 yards fewer…" / "Same as the league". */
export function yardsVsLeague(team: number, league: number): string {
  const d = Math.round((team - league) * 10) / 10;
  if (d === 0) return "Same as the league";
  const n = Math.abs(d).toFixed(1);
  return `${n} ${n === "1.0" ? "yard" : "yards"} ${d > 0 ? "more" : "fewer"} than the league`;
}
