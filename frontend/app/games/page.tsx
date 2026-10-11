import Link from "next/link";
import { ExampleBanner } from "../../components/ExampleBanner";
import { TruthChip } from "../../components/TruthChip";
import { fetchGames } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  const result = await fetchGames(2023);
  const { data: games, source, banner } = result;

  return (
    <main className="main" id="main">
      <header className="section-head">
        <div className="overline">
          <TruthChip kind="historical" />
          <span className="muted">2023 season</span>
        </div>
        <h1>Game Explorer</h1>
        <p>Pick a real NFL game and walk through what happened, play by play.</p>
      </header>

      {source === "example" && banner ? <ExampleBanner message={banner} /> : null}

      <p className="muted" style={{ marginBottom: "1rem" }}>
        {games.total} games
        {source === "live" ? " from your local data lake" : " in this example set"}
      </p>

      <table className="game-table">
        <thead>
          <tr>
            <th>Week</th>
            <th>Matchup</th>
            <th>Date</th>
            <th>Final</th>
          </tr>
        </thead>
        <tbody>
          {games.items.map((g) => (
            <tr key={g.game_id}>
              <td className="mono">{g.week}</td>
              <td>
                <Link href={`/games/${encodeURIComponent(g.game_id)}`}>
                  {g.away_team_id} @ {g.home_team_id}
                </Link>
              </td>
              <td className="mono">{g.game_date}</td>
              <td className="mono">
                {g.away_score ?? "—"}–{g.home_score ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
