import Link from "next/link";
import { fetchGames } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function GamesPage() {
  let error: string | null = null;
  let games: Awaited<ReturnType<typeof fetchGames>> | null = null;
  try {
    games = await fetchGames(2023);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load games";
  }

  return (
    <main className="main">
      <header className="section-head">
        <div className="overline">
          <span className="truth-chip">Historical</span>
          <span className="muted">2023 season</span>
        </div>
        <h1>Game Explorer</h1>
        <p>Select a real NFL game to inspect ordered play-by-play.</p>
      </header>

      {error ? (
        <div className="error-band" role="alert">
          Could not load games from the API ({error}). Start the backend with
          ingested 2023 data: <span className="mono">python -m nfl_sim.api</span>
        </div>
      ) : null}

      {games ? (
        <>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            {games.total} games · truth label {games.truth_label}
          </p>
          <table className="game-table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Matchup</th>
                <th>Date</th>
                <th>Score</th>
                <th>Type</th>
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
                  <td>{g.season_type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </main>
  );
}
