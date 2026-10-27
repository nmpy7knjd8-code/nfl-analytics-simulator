import type { Metadata } from "next";
import Link from "next/link";
import { periodName, quarterClockFromHalf } from "../../../lib/clock";
import { shareMetadata } from "../../../lib/share";
import { TruthChip } from "../../../components/TruthChip";
import { fetchGame, fetchPlays, fetchWinProbability } from "../../../lib/api";
import { FIXTURE_GAMES } from "../../../lib/fixtures";
import { OvertimePlayList, SwingPlayList, WinProbabilityChart } from "../../../components/WinProbabilityChart";
import { findSwingPlays } from "../../../lib/winProbability";

type Props = { params: Promise<{ gameId: string }> };

export function generateStaticParams() {
  return FIXTURE_GAMES.items.map((g) => ({ gameId: g.game_id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = decodeURIComponent((await params).gameId);
  const g = FIXTURE_GAMES.items.find((x) => x.game_id === id);
  const matchup = g ? `${g.away_team_id} ${g.away_score ?? ""} @ ${g.home_team_id} ${g.home_score ?? ""}`.replace(/ +/g, " ").trim() : id;
  const when = g ? `Week ${g.week}, ${g.season}` : "";
  return shareMetadata({
    title: `${matchup} — game story`,
    description: `Every play of ${matchup}${when ? ` (${when})` : ""} with its win-chance swing.`,
    path: `/games/${id}/`,
    card: `games/${id}`,
    alt: `${matchup}${when ? `, ${when}` : ""}: the plays that swung it. Data: nflverse`,
  });
}

function formatClock(quarter: number, halfSeconds: number | null | undefined): string {
  if (halfSeconds == null) return "—";
  return quarterClockFromHalf(quarter, halfSeconds);
}

/** reference.wp is the possession team's pre-snap chance; always say whose it is. */
export default async function GameReplayPage({ params }: Props) {
  const { gameId } = await params;
  const id = decodeURIComponent(gameId);

  let error: string | null = null;
  let game: Awaited<ReturnType<typeof fetchGame>> | null = null;
  let plays: Awaited<ReturnType<typeof fetchPlays>> | null = null;
  try {
    [game, plays] = await Promise.all([fetchGame(id), fetchPlays(id)]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load game";
  }

  // Contract endpoint first; otherwise the clearly labeled example series.
  const wpSeries = game ? await fetchWinProbability(id) : null;
  const swings = wpSeries ? findSwingPlays(wpSeries.series) : [];


  return (
    <main className="main page" id="main">
      <Link className="back-link" href="/games">
        ← Games
      </Link>

      {error ? (
        <div className="error-band" role="alert">
          {error}
        </div>
      ) : null}

      

      {game && plays ? (
        <>
          <header className="section-head">
            <div className="overline">
              <TruthChip kind="historical" />
              <span className="muted">
                Week {game.data.week} · {game.data.game_date}
              </span>
            </div>
            <div className="scoreboard">
              <h1 className="scoreboard-matchup">
                {game.data.away_team_id} @ {game.data.home_team_id}
              </h1>
              <span className="scoreboard-final">
                {game.data.away_score ?? "—"}–{game.data.home_score ?? "—"}
              </span>
            </div>
            <p>Scroll the story.</p>
          </header>

          {wpSeries ? (
            <section aria-labelledby="wp-head">
              <h2 id="wp-head">Win chance</h2>
              <WinProbabilityChart series={wpSeries.series} swings={swings} note={wpSeries.note} />
              {swings.length ? <h3>Swing plays</h3> : null}
              <SwingPlayList swings={swings} />
              {wpSeries.overtimePlays.length ? <h3>Overtime</h3> : null}
              <OvertimePlayList plays={wpSeries.overtimePlays} />
            </section>
          ) : null}

          {/* QA H7: the old hand-written list stated wrong facts; hidden until #76 builds it from lib/plays. */}
          <p className="muted play-feed-soon">Full play-by-play coming soon.</p>

          <aside className="disclaimer">
            Win chance is an estimate of each side’s chances at the snap.
          </aside>
        </>
      ) : null}
    </main>
  );
}
