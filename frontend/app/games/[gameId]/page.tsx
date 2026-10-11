import Link from "next/link";
import { ExampleBanner } from "../../../components/ExampleBanner";
import { TruthChip } from "../../../components/TruthChip";
import { fetchGame, fetchPlays } from "../../../lib/api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ gameId: string }> };

function formatClock(halfSeconds: number | null | undefined): string {
  if (halfSeconds == null) return "—";
  const m = Math.floor(halfSeconds / 60);
  const s = halfSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function winChanceLabel(wp: number | null | undefined): string | null {
  if (wp == null || Number.isNaN(wp)) return null;
  return `${Math.round(wp * 100)}% win chance`;
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

  const source = game?.source ?? plays?.source;
  const banner = game?.banner ?? plays?.banner;

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

      {source === "example" && banner ? <ExampleBanner message={banner} /> : null}

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

          <p className="list-count">{plays.data.total} plays</p>

          <div className="play-feed" role="list">
            {plays.data.items.map((p) => {
              const chance = winChanceLabel(p.reference?.wp ?? null);
              return (
                <article className="play-card" role="listitem" key={`${p.game_id}-${p.play_id}`}>
                  <div className="play-top">
                    <span className="play-meta">
                      Q{p.quarter}
                      {p.down != null ? ` · ${p.down}&${p.distance}` : ""} ·{" "}
                      {formatClock(p.half_seconds_remaining ?? null)}
                    </span>
                    <span className="play-meta">#{p.play_index}</span>
                  </div>
                  <p className="play-desc">
                    {p.description ? (
                      p.description
                    ) : (
                      <>
                        <strong>{p.play_type}</strong>
                        {p.possession_team_id ? ` · ${p.possession_team_id}` : ""}
                      </>
                    )}
                  </p>
                  {chance ? <div className="win-chance">{chance}</div> : null}
                </article>
              );
            })}
          </div>

          <aside className="disclaimer">
            {source === "example"
              ? "Short example replay — connect the API for full 2023 play-by-play."
              : "Win chance is an estimate at the snap — not a bet."}
          </aside>
        </>
      ) : null}
    </main>
  );
}
