"use client";

import { useState } from "react";
import { era, goRate, type EraZoneId } from "../lib/era";
import { Header, Trademark } from "./SimpleGame";

const W = 358, H = 220, L = 30, R = 84, T = 12, B = 26, YMAX = 40;
const SHADE: Record<EraZoneId, string> = { opp: "#1E5BFF", mid: "#8fb0ff", own: "#9aa0a6" };
const fmt = (p: number | null) => (p === null ? "—" : `${Math.round(p)}%`);

export function EraChart() {
  const seasons = era.seasons;
  const [sel, setSel] = useState(seasons.length - 1);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(seasons.length - 1, 1);
  const y = (p: number) => T + (1 - p / YMAX) * (H - T - B);
  const cur = seasons[sel];

  return (
    <div className="sg-app kb">
      <Header right="4th downs" />
      <h1 className="kb-h1">Going for it, then and now</h1>
      <p className="kb-lede">How often NFL teams went for it on 4th down, season by season. Tap a season.</p>
      <section className="kb-hero ch-card">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="How often teams went for it on 4th down, by season and field zone">
          {[0, 10, 20, 30, 40].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e6e6e6" />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="era-ax">{v}%</text>
            </g>
          ))}
          <line x1={x(sel)} x2={x(sel)} y1={T} y2={H - B} stroke="#9aa0a6" strokeDasharray="3 3" />
          {era.zones.map((z) => {
            const pts = seasons.map((s, i) => [x(i), y(goRate(s[z.id]) ?? 0)] as const);
            const last = pts[pts.length - 1];
            return (
              <g key={z.id}>
                <polyline fill="none" stroke={SHADE[z.id]} strokeWidth={2.5} points={pts.map((p) => p.join(",")).join(" ")} />
                {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r={i === sel ? 4.5 : 2.5} fill={SHADE[z.id]} />)}
                <text x={last[0] + 8} y={last[1] + 4} className="era-lbl" fill={SHADE[z.id]}>{z.short}</text>
              </g>
            );
          })}
          {seasons.map((s, i) => (
            <text key={s.season} x={x(i)} y={H - 8} textAnchor="middle" className={`era-ax${i === sel ? " is-on" : ""}`}>{`'${String(s.season).slice(2)}`}</text>
          ))}
          {seasons.map((s, i) => (
            <rect key={s.season} x={x(i) - 18} y={0} width={36} height={H} fill="transparent" style={{ cursor: "pointer" }} onClick={() => setSel(i)} aria-hidden="true" />
          ))}
        </svg>
        <div className="pf-chips ch-chips" role="group" aria-label="Season">
          {seasons.map((s, i) => (
            <button key={s.season} type="button" className={`pf-chip${i === sel ? " is-on" : ""}`} aria-pressed={i === sel} onClick={() => setSel(i)}>{s.season}</button>
          ))}
        </div>
      </section>

      <section className="kb-hero ch-pick" aria-live="polite">
        <div className="era-pick-h">In {cur.season}, teams went for it on</div>
        <ul className="era-rows">
          {era.zones.map((z) => (
            <li key={z.id}><span className="era-dot" style={{ background: SHADE[z.id] }} />{z.label}<strong>{fmt(goRate(cur[z.id]))}</strong></li>
          ))}
          <li className="era-all"><span className="era-dot" />All 4th downs<strong>{fmt(goRate(cur.all))}</strong></li>
        </ul>
      </section>

      <p className="kb-note">
        Went for it = a run or pass on 4th down, out of runs, passes, punts and field goals. Zones are yards from the opponent&apos;s goal line: 1–40, 41–60, 61–99. Data: nflverse play-by-play.
      </p>
      <Trademark />
    </div>
  );
}
