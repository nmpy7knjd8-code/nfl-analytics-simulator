// Dumps what the share cards show (games, 4th-down scenarios, quiz items) as JSON for make_cards.py.
import { FIXTURE_GAMES, FOURTH_DOWN_SCENARIOS } from "../../frontend/lib/fixtures";
import quizPack from "../../frontend/lib/quizPack.json";

process.stdout.write(
  JSON.stringify({ games: FIXTURE_GAMES.items, scenarios: FOURTH_DOWN_SCENARIOS, quiz: quizPack.items }),
);
