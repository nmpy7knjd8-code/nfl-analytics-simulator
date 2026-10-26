"use client";

import { useState } from "react";
import {
  clockLabel,
  fieldPosition,
  type SwingPlay,
  type WinProbabilityPoint,
  type WinProbabilitySeries,
} from "../lib/winProbability";

const W = 640;
const H = 230;
const PAD = { l: 40, r: 12, t: 22, b: 26 };
const REG = 3600;
const OT_SPAN = 600; // one 10-minute regular-season OT period
const OT_WIDTH = 300; // drawn as a shorter segment after regulation

/** x position from the game clock: regulation 0..3600 s, then a short OT segment. */
function elapsedOf(p: WinProbabilityPoint): number {
  if (p.quarter > 4) return REG + OT_WIDTH * (1 - (p.ot_seconds_remaining ?? 0) / OT_SPAN);
  return REG - p.game_seconds_remaining;
}

export function WinProbabilityPanel({
  series,
  swings,
  linkablePlayIds = [],
}: {
  series: WinProbabilitySeries;
  swings: SwingPlay[];
  /** play_ids that exist in the play list below; only these get "jump to play". */
  linkablePlayIds?: string[];
}) {
  const pts = series.points;
  const [sel, setSel] = useState<number>(() => {
    const first = swings[0] ? pts.findIndex((p) => p.play_id === swings[0].point.play_id) : -1;
    return first >= 0 ? first : 0;
  });
  if (pts.length < 2) return <p className="muted">Not enough win-chance data for a chart.</p>;

  const hasOT = pts.some((p) => p.quarter > 4);
  const span = hasOT ? REG + OT_WIDTH : REG;
  const xOf = (e: number) => PAD.l + (e / span) * (W - PAD.l - PAD.r);
  const x = (i: number) => xOf(elapsedOf(pts[i]));
  const y = (wp: number) => PAD.t + (1 - wp) * (H - PAD.t - PAD.b);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.home_wp).toFixed(1)}`).join(" ");
  const swingRank = new Map(swings.map((s, i) => [s.point.play_id, i + 1]));
  const linkable = new Set(linkablePlayIds);
  const { home_team_id: home, away_team_id: away } = series;

  function scrub(e: React.PointerEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    let best = 0;
    for (let i = 1; i < pts.length; i++) if (Math.abs(x(i) - sx) < Math.abs(x(best) - sx)) best = i;
    setSel(best);
  }

  function jumpTo(playId: string) {
    const idx = pts.findIndex((p) => p.play_id === playId);
    if (idx >= 0) setSel(idx);
    if (!linkable.has(playId)) return;
    const el = document.getElementById(`play-${playId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    document.querySelectorAll(".play-card.is-highlighted").forEach((n) => n.classList.remove("is-highlighted"));
    el.classList.add("is-highlighted");
  }

  const cur = pts[sel];
  const pos = fieldPosition(cur, home, away);
  const score = cur.home_score != null && cur.away_score != null ? `${away} ${cur.away_score} – ${home} ${cur.home_score}` : null;
  const dd = cur.down != null && cur.distance != null ? `${cur.down}${["", "st", "nd", "rd", "th"][cur.down] ?? "th"} & ${cur.distance}` : null;

  return (
    <div className="wp-panel">
      <div className="wp-readout" aria-live="polite">
        <div className="wp-readout-top">
          <span className="play-meta">{clockLabel(cur)}</span>
          <strong>
            {Math.round(cur.home_wp * 100)}% {home} · {Math.round((1 - cur.home_wp) * 100)}% {away}
          </strong>
        </div>
        <div className="play-meta">
          {[score, dd, pos].filter(Boolean).join(" · ") || "Score and down not in this data"}
        </div>
        <p className="play-desc">{cur.description ?? "—"}</p>
      </div>

      <figure className="wp-chart">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`Win chance from ${home}'s side over the game. Tap to read any play.`}
          onPointerDown={scrub}
          onPointerMove={(e) => e.buttons && scrub(e)}
        >
          <text x={PAD.l + 2} y={12} className="wp-axis">{home} more likely ↑</text>
          <text x={PAD.l + 2} y={H - PAD.b - 4} className="wp-axis">{away} more likely ↓</text>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0.5)} y2={y(0.5)} className="wp-mid" />
          {[1, 0.5, 0].map((v) => (
            <text key={v} x={PAD.l - 6} y={y(v) + 4} textAnchor="end" className="wp-axis">
              {Math.round(v * 100)}%
            </text>
          ))}
          {[1, 2, 3, 4].map((q) => (
            <g key={q}>
              <line x1={xOf((q - 1) * 900)} x2={xOf((q - 1) * 900)} y1={PAD.t} y2={H - PAD.b} className="wp-grid" />
              <text x={xOf((q - 1) * 900) + 4} y={H - 8} className="wp-axis">Q{q}</text>
            </g>
          ))}
          {hasOT ? (
            <g>
              <rect x={xOf(REG)} y={PAD.t} width={xOf(span) - xOf(REG)} height={H - PAD.t - PAD.b} className="wp-ot" />
              <text x={xOf(REG) + 4} y={H - 8} className="wp-axis">OT</text>
            </g>
          ) : null}
          <path d={path} className="wp-line" />
          <line x1={x(sel)} x2={x(sel)} y1={PAD.t} y2={H - PAD.b} className="wp-cursor" />
          <circle cx={x(sel)} cy={y(cur.home_wp)} r={4} className="wp-cursor-dot" />
          {pts.map((p, i) => {
            const n = swingRank.get(p.play_id);
            return n ? (
              <g key={p.play_id} className="wp-swing-g" onPointerDown={(e) => { e.stopPropagation(); jumpTo(p.play_id); }}>
                <circle cx={x(i)} cy={y(p.home_wp)} r={8} className="wp-swing" />
                <text x={x(i)} y={y(p.home_wp) + 3.5} textAnchor="middle" className="wp-swing-num">{n}</text>
              </g>
            ) : null;
          })}
        </svg>
        <figcaption className="muted">
          Always from {home}&apos;s side: up means {home} is more likely to win. Each point is the chance at
          the snap. Numbered blue dots are the biggest swing plays (8+ points). Tap the chart to read any play.{" "}
          {series.source_note}
        </figcaption>
      </figure>

      {swings.length ? <h3>Swing plays</h3> : null}
      {swings.length < 3 ? (
        <p className="muted">
          {swings.length === 0 ? "No play" : `Only ${swings.length} play${swings.length === 1 ? "" : "s"}`} moved
          win chance by 8 points or more.
        </p>
      ) : null}
      <ol className="swing-list">
        {swings.map((s, i) => (
          <li key={s.point.play_id} className="swing-item">
            <button type="button" className="swing-btn" onClick={() => jumpTo(s.point.play_id)}>
              <span className="swing-num">{i + 1}</span>
              <span>
                <span className="play-meta">
                  {clockLabel(s.point)} · {s.favored_team_id} +{Math.round(Math.abs(s.delta) * 100)}%
                </span>
                <span className="play-desc">{s.point.description}</span>
                <span className="swing-why">
                  <strong>Why:</strong> {s.why}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
