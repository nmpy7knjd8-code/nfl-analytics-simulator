import {
  clockLabel,
  situationLine,
  type EventPoint,
  type OvertimePlay,
  type SwingPlay,
  type WinProbabilitySeries,
} from "../lib/winProbability";

/** Fan text from the export (#86): display_text, else raw nflverse desc. */
function fanText(p: EventPoint): string {
  return p.display_text?.trim() || p.raw_desc?.trim() || p.description || "";
}

const W = 640;
const H = 220;
const PAD = { l: 64, r: 12, t: 12, b: 26 };

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
  // UI Critic 2110 P2-B: numbered dots; a dot within 18px of an earlier one lifts 14px on a leader line.
  const dots = swings
    .map((s, rank) => {
      const i = pts.findIndex((p) => p.id === s.point.play_id);
      return i < 0 ? null : { rank: rank + 1, cx: x(i), cy: y(pts[i].wp), title: fanText(s.point) };
    })
    .filter((d): d is { rank: number; cx: number; cy: number; title: string } => d !== null)
    .sort((a, b) => a.cx - b.cx);
  const placed: { rank: number; cx: number; cy: number; dy: number; title: string }[] = [];
  for (const d of dots) {
    let dy = 0;
    while (placed.some((q) => Math.hypot(q.cx - d.cx, q.cy + q.dy - (d.cy + dy)) < 18)) dy -= 14;
    placed.push({ ...d, dy });
  }

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
        {placed.map((d) => (
          <g key={d.rank} className="wp-swing-dot">
            {d.dy ? <line x1={d.cx} x2={d.cx} y1={d.cy} y2={d.cy + d.dy} className="wp-leader" /> : null}
            <circle cx={d.cx} cy={d.cy + d.dy} r={7} className="wp-swing">
              <title>{`${d.rank}. ${d.title}`}</title>
            </circle>
            <text x={d.cx} y={d.cy + d.dy + 3.5} textAnchor="middle" className="wp-swing-num" aria-hidden="true">
              {d.rank}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="muted">
        Line shows {series.home_team_id}&apos;s chance to win (top = {series.home_team_id}, bottom ={" "}
        {series.away_team_id}). Numbered blue dots are the biggest swing plays.
        {series.has_overtime ? " The game went to overtime; the line stops at the end of regulation." : ""}
      </figcaption>
      <p className="wp-source">{note}</p>
    </figure>
  );
}

export function SwingPlayList({ swings, series }: { swings: SwingPlay[]; series: WinProbabilitySeries }) {
  if (!swings.length) return null;
  return (
    <ol className="swing-list">
      {swings.map((s, i) => {
        const p = s.point as EventPoint;
        const sit = situationLine(p, series.home_team_id, series.away_team_id);
        const raw = p.raw_desc ?? p.description ?? "";
        const text = fanText(p);
        return (
        <li key={s.point.play_id} className="swing-item">
          <div className="play-meta">
            <span className="swing-badge" aria-hidden="true">{i + 1}</span>
            {clockLabel(s.point)} · {s.favored_team_id} gains {Math.round(Math.abs(s.delta) * 100)} pts
          </div>
          {sit ? <div className="swing-sit">{sit}</div> : null}
          <p className="play-desc swing-headline">{text}</p>
          {raw && raw !== text ? (
            <details className="swing-raw">
              <summary>Play-by-play text</summary>
              <p>{raw}</p>
            </details>
          ) : null}
          <p className="swing-why">
            <strong>Why:</strong> {s.why}
          </p>
        </li>
        );
      })}
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
          <p className="play-desc">{fanText(p as EventPoint)}</p>
        </li>
      ))}
    </ol>
  );
}
