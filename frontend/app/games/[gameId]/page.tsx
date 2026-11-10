import type { Metadata } from "next";
import Link from "next/link";
import { shareMetadata } from "../../../lib/share";
import { Header, Trademark } from "../../../components/SimpleGame";
import { GameScoreBug } from "../../../components/GameScoreBug";
import { fetchGame, fetchPlays, fetchWinProbability } from "../../../lib/api";
import { FIXTURE_GAMES, GAME_SOURCE_LINE } from "../../../lib/fixtures";
import { SwingPlayList, WinProbabilityChart } from "../../../components/WinProbabilityChart";
import { findSwingPlays, inGameOrder } from "../../../lib/winProbability";
import { GAME_PLAY_LISTS } from "../../../lib/gamePlays";
import type { FeedRow } from "../../../lib/gameFileV2";
import { openingWinChance } from "../../../lib/wpFixtures";
import { humanDate } from "../../../lib/drives";
import { GameDetail } from "./GameDetail";
import "../games-ios.css";

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
    title: `${matchup} game story · Fourth & Daily`,
    description: `Every play of ${matchup}${when ? ` (${when})` : ""} with its win-chance swing.`,
    path: `/games/${id}/`,
    card: `games/${id}`,
    alt: `${matchup}${when ? `, ${when}` : ""}: the plays that swung it. Data: nflverse`,
  });
}

/** Whole percents (UI Critic 2240 P3-B): the chart axis is whole percents too. */
function pct(v: number): string {
  return `${Math.round(v * 100)}%`;
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

  const wpSeries = game ? await fetchWinProbability(id) : null;
  const swings = wpSeries ? inGameOrder(findSwingPlays(wpSeries.series)) : [];
  const swingRank = new Map(swings.map((s, i) => [s.point.play_id, i + 1]));
  const fileRows = new Map((GAME_PLAY_LISTS[id]?.plays ?? []).map((r) => [r.play_id, r]));
  const fallbackRows: FeedRow[] = (plays?.data.items ?? []).map((p) => ({
    id: p.play_id,
    quarter: p.quarter,
    clock_seconds:
      p.half_seconds_remaining == null ? null : p.quarter > 4 || p.quarter % 2 === 0 ? p.half_seconds_remaining : p.half_seconds_remaining - 900,
    down: p.down ?? null,
    distance: p.distance ?? null,
    text: p.description ?? "",
    penalty_text: fileRows.get(p.play_id)?.penalty_text ?? null,
  }));
  const opening = game ? openingWinChance(id) : null;
  const overtime = (wpSeries?.overtimePlays.length ?? 0) > 0 || !!wpSeries?.series.has_overtime;
  const winner =
    game && game.data.home_score != null && game.data.away_score != null && game.data.home_score !== game.data.away_score
      ? game.data.home_score > game.data.away_score
        ? game.data.home_team_id
        : game.data.away_team_id
      : null;

  return (
    <main id="main">
      <div className="sg-app ios-games">
        <Header right="Games" />
        <Link className="ios-back" href="/games/">
          ‹ Games
        </Link>

        {error ? (
          <div className="ios-games-error" role="alert">
            {error}
          </div>
        ) : null}

        {game && plays ? (
          <>
            <div className="gsb-sticky">
              <GameScoreBug
                away={game.data.away_team_id}
                home={game.data.home_team_id}
                awayScore={game.data.away_score ?? null}
                homeScore={game.data.home_score ?? null}
                overtime={overtime}
                week={game.data.week}
                date={game.data.game_date}
              />
              <p className="ios-game-when">
                {humanDate(game.data.game_date)}
                {overtime && winner ? ` · ${winner} wins in overtime` : overtime ? " · Overtime" : ""}
              </p>
            </div>

            {wpSeries ? (
              <section className="ios-card ios-chart-card" aria-labelledby="wp-head">
                <h2 id="wp-head" className="ios-card-title">
                  Win chance
                </h2>
                {opening ? (
                  <p className="wp-opening">
                    At kickoff: {game.data.away_team_id} {pct(opening.away)} · {game.data.home_team_id} {pct(opening.home)}
                  </p>
                ) : null}
                <WinProbabilityChart series={wpSeries.series} swings={swings} note={wpSeries.note} />
                {swings.length ? <h3 className="ios-card-sub">Swing plays</h3> : null}
                <SwingPlayList swings={swings} series={wpSeries.series} />
              </section>
            ) : null}

            <GameDetail gameId={id} fallback={fallbackRows} swingRanks={[...swingRank]} />

            <p className="ios-games-src">{GAME_SOURCE_LINE} Win chance is an estimate of each side’s chances at the snap.</p>
          </>
        ) : null}

        <Trademark />
      </div>
    </main>
  );
}
