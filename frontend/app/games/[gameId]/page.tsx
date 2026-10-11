import Link from "next/link";
import { fetchGame, fetchPlays } from "../../../lib/api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ gameId: string }> };

function formatClock(halfSeconds: number | null | undefined): string {
  if (halfSeconds == null) return "—";
  const m = Math.floor(halfSeconds / 60);
  const s = halfSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
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

  return (
    <main className="main">
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/games">← All games</Link>
      </p>

      {error ? (
        <div className="error-band" role="alert">
          {error}
        </div>
      ) : null}

      {game && plays ? (
        <>
          <header className="section-head">
            <div className="overline">
              <span className="truth-chip">Historical</span>
              <span className="mono muted">{game.game_id}</span>
            </div>
            <h1>
              {game.away_team_id} @ {game.home_team_id}
            </h1>
            <p>
              Week {game.week} · {game.game_date} · final{" "}
              <span className="mono">
                {game.away_score ?? "—"}–{game.home_score ?? "—"}
              </span>
              . Plays shown in source order.
            </p>
          </header>

          <p className="muted" style={{ marginBottom: "0.75rem" }}>
            {plays.total} plays
          </p>

          <div className="play-list" role="list">
            {plays.items.map((p) => (
              <article className="play-row" role="listitem" key={`${p.game_id}-${p.play_id}`}>
                <div className="play-meta mono">#{p.play_index}</div>
                <div className="play-meta">Q{p.quarter}</div>
                <div className="play-meta mono">
                  {p.down != null ? `${p.down}&${p.distance}` : "—"} ·{" "}
                  {p.yardline_100 != null ? `${p.yardline_100}` : "—"} ·{" "}
                  {formatClock(p.half_seconds_remaining ?? null)}
                </div>
                <p className="play-desc">
                  <strong>{p.play_type}</strong>
                  {p.possession_team_id ? ` · ${p.possession_team_id}` : ""}
                  {p.description ? ` — ${p.description}` : ""}
                </p>
                <div className="ref-stats" title="Imported nflverse/nflfastR reference columns">
                  ref EP {p.reference?.ep?.toFixed?.(2) ?? "—"} · WP{" "}
                  {p.reference?.wp != null ? (p.reference.wp * 100).toFixed(1) + "%" : "—"}
                </div>
              </article>
            ))}
          </div>

          <aside className="disclaimer">
            {plays.reference_disclaimer} These are not predictions from models
            trained in this repository.
          </aside>
        </>
      ) : null}
    </main>
  );
}
