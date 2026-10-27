import { PlayPenalty } from "./PlayText";
import {
  clockLabel,
  situationLine,
  swingMeta,
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
const PAD = { l: 92, r: 12, t: 16, b: 34 };

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
  // Numbered dots (UI Critic 2110 P2-B). A dot too close to an earlier one lifts on a leader line.
  // Two layouts: desktop (r 7, 18-unit threshold, 14-unit lift) and phones, where the 640-wide SVG
  // renders at ~0.55x (2240 P2-C: r 12, 26-unit threshold, 22-unit lift). CSS shows one of them.
  const dots = swings
    .map((s, rank) => {
      const i = pts.findIndex((p) => p.id === s.point.play_id);
      return i < 0 ? null : { rank: rank + 1, cx: x(i), cy: y(pts[i].wp), title: fanText(s.point) };
    })
    .filter((d): d is { rank: number; cx: number; cy: number; title: string } => d !== null)
    .sort((a, b) => a.cx - b.cx);
  const layout = (threshold: number, lift: number) => {
    const placed: { rank: number; cx: number; cy: number; dy: number; title: string }[] = [];
    for (const d of dots) {
      let dy = 0;
      while (placed.some((q) => Math.hypot(q.cx - d.cx, q.cy + q.dy - (d.cy + dy)) < threshold)) dy -= lift;
      placed.push({ ...d, dy });
    }
    return placed;
  };
  const dotLayers = [
    { cls: "wp-dots wp-dots-wide", r: 7, placed: layout(18, 14) },
    { cls: "wp-dots wp-dots-narrow", r: 12, placed: layout(26, 22) },
  ];

  return (
    <figure className="wp-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Win chance for ${series.home_team_id} over the game`}>
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} className="wp-mid" />
        {[1, 0.5, 0].map((v) => (
          <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="wp-axis">
            <tspan className="wp-axis-team">{series.home_team_id} </tspan>
            {Math.round(v * 100)}%
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
        {dotLayers.map((layer) => (
          <g key={layer.cls} className={layer.cls}>
            {layer.placed.map((d) => (
              <g key={d.rank} className="wp-swing-dot">
                {d.dy ? <line x1={d.cx} x2={d.cx} y1={d.cy} y2={d.cy + d.dy} className="wp-leader" /> : null}
                <circle cx={d.cx} cy={d.cy + d.dy} r={layer.r} className="wp-swing">
                  <title>{`${d.rank}. ${d.title}`}</title>
                </circle>
                <text x={d.cx} y={d.cy + d.dy} dy="0.35em" textAnchor="middle" className="wp-swing-num" aria-hidden="true">
                  {d.rank}
                </text>
              </g>
            ))}
          </g>
        ))}
      </svg>
      <figcaption className="muted">
        Line shows {series.home_team_id}&apos;s chance to win (top = {series.home_team_id}, bottom ={" "}
        {series.away_team_id}). Numbered blue dots are the biggest swing plays, in game order.
        {series.has_overtime ? " The game went to overtime; the line stops at the end of regulation." : ""}
      </figcaption>
      <p className="wp-source">{note}</p>
    </figure>
  );
}

/** "Play-by-play text" disclosure for the raw nflverse string (only when it differs from the fan text). */
function RawText({ raw: full, text }: { raw: string; text: string }) {
  // Recheck 2255 P2-A: the card already shows the clock, so drop nflverse's "(9:21) " prefix.
  const raw = full.replace(/^\(\d{1,2}:\d{2}\)\s*/, "");
  if (!raw || raw === text) return null;
  return (
    <details className="swing-raw">
      <summary>Play-by-play text</summary>
      <p>{raw}</p>
    </details>
  );
}

/** Swing cards in the order given (the page passes game order); each links to its play-by-play row. */
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
              {clockLabel(s.point)} · {swingMeta(s)}
            </div>
            {sit ? <div className="swing-sit">{sit}</div> : null}
            <p className="play-desc swing-headline">
              <a className="swing-link" href={`#play-${s.point.play_id}`}>{text}</a>
              <PlayPenalty text={p.penalty_text} />
            </p>
            <RawText raw={raw} text={text} />
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
export function OvertimePlayList({ plays, decided = true }: { plays: OvertimePlay[]; decided?: boolean }) {
  if (!plays.length) return null;
  const lastId = plays.at(-1)!.play_id;
  return (
    <ol className="swing-list ot-list">
      {plays.map((p) => (
        <li key={p.play_id} className="swing-item ot-item">
          <div className="play-meta">
            {decided && p.play_id === lastId ? <span className="ot-winner">Game-winning play · </span> : null}
            {clockLabel(p)}
          </div>
          <p className="play-desc swing-headline">
            {fanText(p as EventPoint)}
            <PlayPenalty text={p.penalty_text} />
          </p>
          <RawText raw={p.raw_desc ?? p.description ?? ""} text={fanText(p as EventPoint)} />
        </li>
      ))}
    </ol>
  );
}
