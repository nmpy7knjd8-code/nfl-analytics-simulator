import Link from "next/link";
import { GAME_SOURCE_LINE } from "../../lib/fixtures";
import { TruthChip } from "../../components/TruthChip";
import { shareMetadata } from "../../lib/share";
import { fetchGames } from "../../lib/api";

export const metadata = shareMetadata({
  title: "Games — NFL Analytics Simulator",
  description: "Replay NFL games play by play with the win-chance swing of every play.",
  path: "/games/",
  card: "games",
  alt: "NFL game stories: every play's win-chance swing. Data: nflverse",
});

export default async function GamesPage() {
  const result = await fetchGames(2023);
  const { data: games } = result;

  return (
    <main className="main page" id="main">
      <header className="section-head">
        <div className="overline">
          <TruthChip kind="historical" />
          <span className="muted">2023</span>
        </div>
        <h1>Games</h1>
        <p className="games-intro">Pick a matchup and see the plays that swung it.</p>
      </header>

      <p className="wp-source game-source">{GAME_SOURCE_LINE}</p>

      <p className="list-count">
        {games.total} games
      </p>

      <ul className="game-list">
        {games.items.map((g) => (
          <li key={g.game_id}>
            <Link className="game-row" href={`/games/${encodeURIComponent(g.game_id)}`}>
              <span className="game-row-main">
                <span className="game-row-matchup">
                  {g.away_team_id} @ {g.home_team_id}
                </span>
                <span className="game-row-meta">
                  Week {g.week} · {g.game_date}
                </span>
              </span>
              <span className="game-row-score">
                {g.away_score ?? "—"}–{g.home_score ?? "—"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
