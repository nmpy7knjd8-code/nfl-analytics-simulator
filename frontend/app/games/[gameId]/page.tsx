import type { Metadata } from "next";
import Link from "next/link";
import { shareMetadata } from "../../../lib/share";
import { TruthChip } from "../../../components/TruthChip";
import { fetchGame, fetchPlays, fetchWinProbability } from "../../../lib/api";
import { FIXTURE_GAMES } from "../../../lib/fixtures";
import { OvertimePlayList, SwingPlayList, WinProbabilityChart } from "../../../components/WinProbabilityChart";
import { findSwingPlays, inGameOrder } from "../../../lib/winProbability";
import { GAME_PLAY_LISTS } from "../../../lib/gamePlays";
import { PlayFeed } from "../../../components/PlayFeed";
import type { FeedRow } from "../../../lib/gameFileV2";
import { openingWinChance } from "../../../lib/wpFixtures";

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

  // Contract endpoint first; otherwise the clearly labeled example series.
  const wpSeries = game ? await fetchWinProbability(id) : null;
  // Biggest three swings, shown in game order so card and dot numbers read left to right.
  const swings = wpSeries ? inGameOrder(findSwingPlays(wpSeries.series)) : [];
  const swingRank = new Map(swings.map((s, i) => [s.point.play_id, i + 1]));
  // UI Critic 2240 P2-A: OT plays use the plays file's fan text when the OT export lacks it.
  const fileRows = new Map((GAME_PLAY_LISTS[id]?.plays ?? []).map((r) => [r.play_id, r]));
  const overtimePlays = (wpSeries?.overtimePlays ?? []).map((p) => {
    const r = fileRows.get(p.play_id);
    return { ...p, display_text: p.display_text || r?.display_text, raw_desc: p.raw_desc || r?.raw_desc };
  });
  // Committed lib/plays rows: static fallback and display_text source for the live game.v2 file.
  const fallbackRows: FeedRow[] = (plays?.data.items ?? []).map((p) => ({
    id: p.play_id,
    quarter: p.quarter,
    clock_seconds:
      p.half_seconds_remaining == null ? null : p.quarter > 4 || p.quarter % 2 === 0 ? p.half_seconds_remaining : p.half_seconds_remaining - 900,
    down: p.down ?? null,
    distance: p.distance ?? null,
    text: p.description ?? "",
  }));
  const opening = game ? openingWinChance(id) : null;


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
          </header>

          {wpSeries ? (
            <section aria-labelledby="wp-head">
              <h2 id="wp-head">Win chance</h2>
              {opening ? (
                <p className="wp-opening">
                  At kickoff: {game.data.away_team_id} {pct(opening.away)} · {game.data.home_team_id} {pct(opening.home)}
                </p>
              ) : null}
              <WinProbabilityChart series={wpSeries.series} swings={swings} note={wpSeries.note} />
              {swings.length ? <h3>Swing plays</h3> : null}
              <SwingPlayList swings={swings} series={wpSeries.series} />
              {overtimePlays.length ? <h3>Overtime</h3> : null}
              <OvertimePlayList plays={overtimePlays} />
            </section>
          ) : null}

          <section aria-labelledby="pbp-head">
            <h2 id="pbp-head">Play by play</h2>
            <PlayFeed gameId={id} fallback={fallbackRows} swingRanks={[...swingRank]} />
          </section>

          <aside className="disclaimer">
            Win chance is an estimate of each side’s chances at the snap.
          </aside>
        </>
      ) : null}
    </main>
  );
}
