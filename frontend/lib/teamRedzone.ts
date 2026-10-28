/** F5 red-zone scorecard data: frontend/lib/teamRedzone.json, built by mining/build_team_redzone.py (NFL Data Builders, #166).
 * Shape: /workspace/nfl-research/teams/f5-redzone-json-shape.md */
import raw from "./teamRedzone.json";

export type RedzoneTeamRow = {
  team: string; // nflverse abbr, e.g. "KC"
  drives: number; // red-zone trips (drives with a snap at yardline_100 <= 20)
  td: number; // trips ending in an offensive touchdown
  fg: number; // trips ending in a made field goal
  no_score: number; // every other result
  td_rate: number; // td / drives, 0..1
  rank: number; // 1 = best TD rate in the league
};

export type RedzoneSeason = { league: { drives: number; td: number; td_rate: number }; teams: RedzoneTeamRow[] };

export type RedzoneFile = RedzoneSeason & {
  schema_version: number;
  stub: boolean;
  source: string;
  seasons: [number, number]; // first, last (inclusive)
  season_type: "REG" | "ALL";
  red_zone_def: string;
  season_list: number[];
  /** Per-season data keyed "2019"…, each ranked within its season (#173). Top-level league/teams are the all-seasons totals. */
  by_season: Record<string, RedzoneSeason>;
};

export const REDZONE = raw as unknown as RedzoneFile;
if (REDZONE.stub) throw new Error("teamRedzone.json is marked stub; no sample data may ship");

export const ALL = "all";

/** Season chip keys, oldest first; only seasons present in by_season. */
export function seasonKeys(f: RedzoneFile = REDZONE): string[] {
  return f.season_list.map(String).filter((k) => f.by_season[k]);
}

export function sliceFor(season: string, f: RedzoneFile = REDZONE): RedzoneSeason {
  return season === ALL ? f : f.by_season[season] ?? f;
}

export function rowFor(abbr: string, slice: RedzoneSeason): RedzoneTeamRow | undefined {
  return slice.teams.find((t) => t.team === abbr);
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;

/** "6 percentage points above the league" / "below" / "same as the league" (whole points, from rounded rates). */
export function vsLeague(team: number, league: number): string {
  const d = Math.round(team * 100) - Math.round(league * 100);
  if (d === 0) return "Same as the league";
  return `${Math.abs(d)} percentage point${Math.abs(d) === 1 ? "" : "s"} ${d > 0 ? "above" : "below"} the league`;
}
