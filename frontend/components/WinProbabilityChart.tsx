import { clockLabel, type OvertimePlay, type SwingPlay, type WinProbabilitySeries } from "../lib/winProbability";

const W = 640;
const H = 220;
const PAD = { l: 40, r: 12, t: 12, b: 26 };

export function WinProbabilityChart({
  series,
  swings,
  note,
}: {
  series: WinProbabilitySeries;
  swings: SwingPlay[];
  note: string;
}) {
  // Plot each play's pre-snap value, then the final post-snap result. Regulation only:
  // the line stops at 0:00 of Q4 and overtime gets a plain marker instead (house rule).
  const reg = series.points.filter((p) => !p.is_overtime && p.quarter <= 4);
  const last = reg.at(-1);
  const pts = last
    ? [
        ...reg.map((p) => ({ id: p.play_id, t: p.game_seconds_elapsed, wp: p.home_wp_pre })),
        { id: "__final", t: series.has_overtime ? 3600 : last.game_seconds_elapsed, wp: last.home_wp_post },
      ]
    : [];
  if (pts.length < 2) return <p className="muted">Not enough win-chance data for a chart.</p>;
  const span = 3600;
  const x = (i: number) => PAD.l + (pts[i].t / span) * (W - PAD.l - PAD.r);
  const y = (wp: number) => PAD.t + (1 - wp) * (H - PAD.t - PAD.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.wp).toFixed(1)}`).join(" ");
  const swingIds = new Set(swings.map((s) => s.point.play_id));

  return (
    <figure className="wp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Win chance for ${series.home_team_id} over the game`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} className="wp-mid" />
        {[1, 0.5, 0].map((v) => (
          <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="wp-axis">
            {series.home_team_id} {Math.round(v * 100)}%
          </text>
        ))}
        {[1, 2, 3, 4].map((q) => {
          const qx = PAD.l + (((q - 1) * 900) / span) * (W - PAD.l - PAD.r);
          return (
            <g key={q}>
              <line x1={qx} x2={qx} y1={PAD.t} y2={H - PAD.b} className="wp-grid" />
              <text x={qx + 4} y={H - 8} className="wp-axis">Q{q}</text>
            </g>
          );
        })}
        {series.has_overtime ? (
          <g className="wp-ot-marker">
            <line x1={W - PAD.r} x2={W - PAD.r} y1={PAD.t} y2={H - PAD.b} className="wp-ot-line" />
            <text x={W - PAD.r - 6} y={PAD.t + 14} textAnchor="end" className="wp-ot-label">
              Overtime: win chance not shown
            </text>
          </g>
        ) : null}
        <path d={path} className="wp-line" />
        {pts.map((p, i) =>
          swingIds.has(p.id) ? (
            <circle key={p.id} cx={x(i)} cy={y(p.wp)} r={5} className="wp-swing">
              <title>{reg[i]?.description}</title>
            </circle>
          ) : null,
        )}
      </svg>
      <figcaption className="muted">
        Line shows {series.home_team_id}&apos;s chance to win (top = {series.home_team_id}, bottom ={" "}
        {series.away_team_id}). Each point is the chance at the snap. Blue dots are the biggest swing plays.
        {series.has_overtime ? " The game went to overtime; the line stops at the end of regulation." : ""} {note}
      </figcaption>
    </figure>
  );
}

export function SwingPlayList({ swings }: { swings: SwingPlay[] }) {
  if (!swings.length) return null;
  return (
    <ol className="swing-list">
      {swings.map((s) => (
        <li key={s.point.play_id} className="swing-item">
          <div className="play-meta">
            {clockLabel(s.point)} · {s.favored_team_id} +
            {Math.round(Math.abs(s.delta) * 100)}%
          </div>
          <p className="play-desc">{s.point.description}</p>
          <p className="swing-why">
            <strong>Why:</strong> {s.why}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** Overtime plays: listed like any other play, with no win-chance numbers. */
export function OvertimePlayList({ plays }: { plays: OvertimePlay[] }) {
  if (!plays.length) return null;
  return (
    <ol className="swing-list ot-list">
      {plays.map((p) => (
        <li key={p.play_id} className="swing-item ot-item">
          <div className="play-meta">{clockLabel(p)}</div>
          <p className="play-desc">{p.description}</p>
        </li>
      ))}
    </ol>
  );
}
