/** Typed view of gameFacts.json (generated from nflverse — never edit facts by hand). */
import facts from "./gameFacts.json";

export interface GameFact {
  game_id: string;
  season: number;
  week: number;
  season_type: "REG" | "POST";
  game_date: string;
  home_team_id: string;
  away_team_id: string;
  home_score: number;
  away_score: number;
  overtime: boolean;
  stadium: string;
}

export const GAME_FACTS: GameFact[] = facts.games as GameFact[];
export const GAME_FACTS_BY_ID: Record<string, GameFact> = Object.fromEntries(GAME_FACTS.map((g) => [g.game_id, g]));
