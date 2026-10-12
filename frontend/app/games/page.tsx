import Link from "next/link";
import { ExampleBanner } from "../../components/ExampleBanner";
import { TruthChip } from "../../components/TruthChip";
import { fetchGames } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const result = await fetchGames(2023);
  const { data: games, source, banner } = result;

  return (
    <main className="main page" id="main">
      <header className="section-head">
        <div className="overline">
          <TruthChip kind="historical" />
          <span className="muted">2023</span>
        </div>
        <h1>Games</h1>
        <p>Pick a matchup — walk the story play by play.</p>
      </header>

      {source === "example" && banner ? <ExampleBanner message={banner} /> : null}

      <p className="list-count">
        {games.total} {source === "live" ? "from your lake" : "examples"}
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
