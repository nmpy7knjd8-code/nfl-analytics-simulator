// Dumps what the share cards show (games, 4th-down scenarios, quiz items) as JSON for make_cards.py.
import { FOURTH_DOWN_SCENARIOS } from "../../frontend/lib/fixtures";
import { readFileSync } from "node:fs";
import { STORY_GAME_IDS, type GameFile } from "../../frontend/lib/gameStory";
import quizPack from "../../frontend/lib/quizPack.json";

// One card per game story page (frontend/public/data/games/{id}.json), in make_cards.py's shape.
const games = STORY_GAME_IDS.map((id) => {
  const g = (JSON.parse(readFileSync(new URL(`../../frontend/public/data/games/${id}.json`, import.meta.url), "utf8")) as GameFile).game;
  return { game_id: id, away_team_id: g.away, home_team_id: g.home, away_score: g.away_score, home_score: g.home_score, week: g.week, season: g.season, game_date: g.date };
});

process.stdout.write(JSON.stringify({ games, scenarios: FOURTH_DOWN_SCENARIOS, quiz: quizPack.items }));
