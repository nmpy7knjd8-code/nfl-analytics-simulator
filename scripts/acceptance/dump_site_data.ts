// Dumps every game fact, play clock and kick the site shows, as JSON, for check.py.
import { FIXTURE_GAMES, FOURTH_DOWN_SCENARIOS, fixturePlays } from "../../frontend/lib/fixtures";
import { WP_FIXTURES } from "../../frontend/lib/wpFixtures";
import quizPack from "../../frontend/lib/quizPack.json";

const games = FIXTURE_GAMES.items;
const plays = games.flatMap((g) => fixturePlays(String(g.game_id))?.items ?? []);
const wpPoints = Object.values(WP_FIXTURES).flatMap((s) =>
  s.points.map((p) => ({ ...p, game_id: s.game_id })),
);
process.stdout.write(
  JSON.stringify({ games, plays, wpPoints, wpGameIds: Object.keys(WP_FIXTURES), scenarios: FOURTH_DOWN_SCENARIOS, quiz: quizPack }),
);
