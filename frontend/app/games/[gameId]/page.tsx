import type { Metadata } from "next";
import Link from "next/link";
import { periodName, quarterClockFromHalf } from "../../../lib/clock";
import { shareMetadata } from "../../../lib/share";
import { TruthChip } from "../../../components/TruthChip";
import { fetchGame, fetchPlays, fetchWinProbability } from "../../../lib/api";
import { FIXTURE_GAMES } from "../../../lib/fixtures";
import { OvertimePlayList, SwingPlayList, WinProbabilityChart } from "../../../components/WinProbabilityChart";
import { findSwingPlays } from "../../../lib/winProbability";
import { openingWinChance } from "../../../lib/wpFixtures";
import { matchupColors, tint } from "../../../lib/teamColors";
import { TeamChip } from "../../../components/TeamChip";

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

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

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
  const swingRank = new Map(swings.map((s, i) => [s.point.play_id, i + 1]));
  const opening = game ? openingWinChance(id) : null;
  const colors = game ? matchupColors(game.data.home_team_id, game.data.away_team_id) : null;


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
          <header
            className="section-head matchup-head"
            style={
              colors?.home && colors.away
                ? {
                    borderImage: `linear-gradient(90deg, ${colors.away} 50%, ${colors.home} 50%) 1`,
                    background: `linear-gradient(90deg, ${tint(colors.away)}, ${tint(colors.home)})`,
                  }
                : undefined
            }
          >
            <div className="overline">
              <TruthChip kind="historical" />
              <span className="muted">
                Week {game.data.week} · {game.data.game_date}
              </span>
            </div>
            <div className="scoreboard">
              <h1 className="scoreboard-matchup">
                <span className="team-mark" style={colors?.away ? { borderBottomColor: colors.away } : undefined}>
                  {game.data.away_team_id}
                </span>{" "}
                @{" "}
                <span className="team-mark" style={colors?.home ? { borderBottomColor: colors.home } : undefined}>
                  {game.data.home_team_id}
                </span>
              </h1>
              <span className="scoreboard-final">
                {game.data.away_score ?? "—"}–{game.data.home_score ?? "—"}
              </span>
            </div>
          </header>

          {wpSeries ? (
            <section aria-labelledby="wp-head">
              <h2 id="wp-head">Win chance</h2>
              {opening ? (
                <p className="wp-opening">
                  At kickoff: <TeamChip team={game.data.away_team_id} color={colors?.away} /> {pct(opening.away)} ·{" "}
                  <TeamChip team={game.data.home_team_id} color={colors?.home} /> {pct(opening.home)}
                </p>
              ) : null}
              <WinProbabilityChart series={wpSeries.series} swings={swings} note={wpSeries.note} colors={colors ?? undefined} />
              {swings.length ? <h3>Swing plays</h3> : null}
              <SwingPlayList swings={swings} series={wpSeries.series} colors={colors ?? undefined} />
              {wpSeries.overtimePlays.length ? <h3>Overtime</h3> : null}
              <OvertimePlayList plays={wpSeries.overtimePlays} />
            </section>
          ) : null}

          <section aria-labelledby="pbp-head">
            <h2 id="pbp-head">Play by play</h2>
            {plays.data.items.length ? (
              <>
                <p className="list-count">{plays.data.total} plays</p>
                <ol className="play-feed">
                  {plays.data.items.map((p) => {
                    const rank = swingRank.get(p.play_id);
                    return (
                      <li
                        className={`play-card${rank ? " is-swing" : ""}`}
                        key={`${p.game_id}-${p.play_id}`}
                        data-play-id={p.play_id}
                      >
                        <div className="play-top">
                          <span className="play-meta">
                            {periodName(p.quarter)} · {formatClock(p.quarter, p.half_seconds_remaining ?? null)}
                            {p.down ? ` · ${["", "1st", "2nd", "3rd", "4th"][p.down]} & ${p.distance}` : ""}
                          </span>
                          {rank ? (
                            <span className="swing-badge" aria-label={`Swing play ${rank}`}>
                              {rank}
                            </span>
                          ) : null}
                        </div>
                        <p className="play-desc">{p.description}</p>
                      </li>
                    );
                  })}
                </ol>
              </>
            ) : (
              <p className="muted play-feed-soon">Full play-by-play coming soon.</p>
            )}
          </section>

          <aside className="disclaimer">
            Win chance is an estimate of each side’s chances at the snap.
          </aside>
        </>
      ) : null}
    </main>
  );
}
