"use client";

import { useState } from "react";
import { calib } from "../lib/calib";
import { Header, Trademark } from "./SimpleGame";

const S = 358, P = 42, IN = S - P - 20;
const px = (v: number) => P + (v / 100) * IN;
const py = (v: number) => 10 + (1 - v / 100) * IN;

export function CalibrationChart() {
  const b = calib.buckets;
  const [sel, setSel] = useState(0);
  const cur = b[sel];
  return (
    <div className="sg-app kb">
      <Header right="Win chance" />
      <h1 className="kb-h1">Is 5% really 5%?</h1>
      <p className="kb-lede">When nflverse&apos;s model says a team has a 5% chance to win, do they win about 5% of the time? Tap a dot.</p>
      <section className="kb-hero ch-card">
        <svg viewBox={`0 0 ${S} ${S}`} width="100%" role="img" aria-label="Predicted chance to win against how often the home team actually won">
          {[0, 25, 50, 75, 100].map((v) => (
            <g key={v}>
              <line x1={px(0)} x2={px(100)} y1={py(v)} y2={py(v)} stroke="#e6e6e6" />
              <text x={P - 6} y={py(v) + 4} textAnchor="end" className="era-ax">{v}%</text>
              <text x={px(v)} y={S - 6} textAnchor={v === 100 ? "end" : "middle"} className="era-ax">{v}%</text>
            </g>
          ))}
          <line x1={px(0)} y1={py(0)} x2={px(100)} y2={py(100)} stroke="#9aa0a6" strokeDasharray="4 4" />
          <text x={px(62)} y={py(70)} className="era-ax" transform={`rotate(-45 ${px(62)} ${py(70)})`}>perfectly honest</text>
          {b.map((x, i) => (
            <g key={x.lo} onClick={() => setSel(i)} style={{ cursor: "pointer" }}>
              <circle cx={px(x.predicted)} cy={py(x.actual)} r={14} fill="transparent" />
              <circle cx={px(x.predicted)} cy={py(x.actual)} r={i === sel ? 7 : 5} fill={i === sel ? "#fff" : "#1E5BFF"} stroke="#1E5BFF" strokeWidth={2} />
            </g>
          ))}
        </svg>
        <div className="cal-axes"><span>↑ how often they won</span><span>model said →</span></div>
      </section>

      <section className="kb-hero ch-pick" aria-live="polite">
        <div className="era-pick-h">When nflverse&apos;s model gave the home team {cur.lo}–{cur.hi}%</div>
        <ul className="era-rows">
          <li>Model said, on average<strong>{cur.predicted.toFixed(1)}%</strong></li>
          <li>Home team actually won<strong>{cur.actual.toFixed(1)}%</strong></li>
          <li className="era-all">Plays in this group<strong>{cur.plays.toLocaleString()}</strong></li>
        </ul>
        <div className="pf-chips ch-chips" role="group" aria-label="Pick a group">
          {b.map((x, i) => (
            <button key={x.lo} type="button" className={`pf-chip${i === sel ? " is-on" : ""}`} aria-pressed={i === sel} onClick={() => setSel(i)}>{x.lo}–{x.hi}</button>
          ))}
        </div>
      </section>

      <p className="kb-note">
        Each dot groups every play where nflverse&apos;s model gave the home team about that chance. Dots on the dashed line mean the model was honest. Close games were a little less kind to home teams than the model expected.
      </p>
      <p className="kb-note">
        This checks nflverse&apos;s win-chance model, not our 4th-down model. Regulation only; ties left out. Plays from the same game are linked, so this shows the shape, not exact error bars. Data: nflverse play-by-play, 2019–2025.
        {calib.stub ? " Preview numbers." : ""}
      </p>
      <Trademark />
    </div>
  );
}
