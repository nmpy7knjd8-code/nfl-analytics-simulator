/** F5 red-zone scorecard data. Real file comes from mining/build_team_redzone.py (NFL Data Builders);
 * until then the page reads a clearly labeled stub. Shape: /workspace/nfl-research/teams/f5-redzone-json-shape.md */
import raw from "./teamRedzone.stub.json";

export type RedzoneTeamRow = {
  team: string; // nflverse abbr, e.g. "KC"
  drives: number; // drives that reached the red zone
  td: number; // drives ending in a touchdown
  fg: number; // drives ending in a made field goal
  no_score: number; // every other result (turnover, downs, missed FG, end of half)
  td_rate: number; // td / drives, 0..1
  rank: number; // 1 = best TD rate in the league
};

export type RedzoneFile = {
  schema_version: 1;
  stub: boolean;
  source: string;
  seasons: [number, number]; // first, last (inclusive)
  season_type: "REG" | "ALL";
  red_zone_def: string;
  league: { drives: number; td: number; td_rate: number };
  teams: RedzoneTeamRow[];
};

export const REDZONE = raw as RedzoneFile;

export function redzoneFor(abbr: string): RedzoneTeamRow | undefined {
  return REDZONE.teams.find((t) => t.team === abbr);
}

export const pct = (v: number) => `${Math.round(v * 100)}%`;
