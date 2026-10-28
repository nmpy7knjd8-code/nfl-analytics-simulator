"use client";

import { useState } from "react";
import { outcomes, cellFor, binLabel } from "../lib/outcomes";
import { Header, Trademark } from "./SimpleGame";

const W = 358, H = 200, L = 6, R = 6, T = 10, B = 26;

export function OutcomeHistogram() {
  const [togo, setTogo] = useState(2);
  const [zone, setZone] = useState("all");
  const cell = cellFor(outcomes, togo, zone);
  const bins = outcomes.bins;
  const enough = !!cell && cell.tries >= outcomes.minTries;
  const max = enough ? Math.max(...cell!.counts, 1) : 1;
  const bw = (W - L - R) / bins.length;
  const x = (i: number) => L + i * bw;
  const zeroAt = bins.indexOf(0);
  const toGoAt = bins.indexOf(Math.min(togo, 20));
  const z = outcomes.zones.find((q) => q.id === zone)!;
  const atZero = enough ? cell!.counts[zeroAt] : 0;

  return (
    <div className="sg-app kb">
      <Header right="4th downs" />
      <h1 className="kb-h1">Where 4th downs land</h1>
      <p className="kb-lede">Every real run or pass on 4th down, by how many yards it gained.</p>

      <div className="pf-chips ch-chips" role="group" aria-label="Yards to go">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((t) => (
          <button key={t} type="button" className={`pf-chip${t === togo ? " is-on" : ""}`} aria-pressed={t === togo} onClick={() => setTogo(t)}>
            {t === 10 ? "10+" : t}
          </button>
        ))}
      </div>
      <div className="pf-chips ch-chips" role="group" aria-label="Where on the field">
        {outcomes.zones.map((q) => (
          <button key={q.id} type="button" className={`pf-chip${q.id === zone ? " is-on" : ""}`} aria-pressed={q.id === zone} onClick={() => setZone(q.id)}>
            {q.label}
          </button>
        ))}
      </div>

      <section className="kb-hero ch-card" aria-live="polite">
        <div className="oh-head">4th-and-{togo === 10 ? "10+" : togo} · {z.label.toLowerCase()}</div>
        {enough ? (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Yards gained on 4th-and-${togo}`}>
              <rect x={x(toGoAt)} y={T} width={x(bins.length) - x(toGoAt)} height={H - T - B} fill="#eef3ff" />
              {cell!.counts.map((c, i) => {
                const h = ((H - T - B) * c) / max;
                return <rect key={i} x={x(i) + 1} y={H - B - h} width={bw - 2} height={h} rx={2} fill={i >= toGoAt ? "#1E5BFF" : "#9aa0a6"} />;
              })}
              <line x1={x(toGoAt)} x2={x(toGoAt)} y1={T} y2={H - B} stroke="#1E5BFF" strokeWidth={2} />
              <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="#d9d9d9" />
              {[0, zeroAt, bins.indexOf(10), bins.length - 1].map((i) => (
                <text key={i} x={x(i) + bw / 2} y={H - 8} textAnchor={i === 0 ? "start" : i === bins.length - 1 ? "end" : "middle"} className="era-ax">
                  {i === 0 ? "−5" : binLabel(outcomes, i)}
                </text>
              ))}
            </svg>
            <ul className="era-rows">
              <li>Tries<strong>{cell!.tries.toLocaleString()}</strong></li>
              <li><span className="era-dot" style={{ background: "#1E5BFF" }} />Got the first down<strong>{Math.round((100 * cell!.converted) / cell!.tries)}%</strong></li>
              <li><span className="era-dot" style={{ background: "#9aa0a6" }} />Gained exactly 0 yards<strong>{atZero.toLocaleString()}</strong></li>
              {cell!.penaltyFirstDowns ? <li className="era-all">First downs from a penalty<strong>{cell!.penaltyFirstDowns.toLocaleString()}</strong></li> : null}
            </ul>
          </>
        ) : (
          <p className="oh-empty">Not enough real tries to show ({cell?.tries ?? 0} here; we need {outcomes.minTries}).</p>
        )}
      </section>

      <p className="kb-note">
        Blue bars reached the line to gain. Bars at the edges pool everything at −5 or less and 20 or more. A penalty can give a first down
        without the yards. Data: nflverse play-by-play, {outcomes.seasons[0]}–{outcomes.seasons[1]}. Includes overtime. Data through {outcomes.dataThrough}.
      </p>
      <Trademark />
    </div>
  );
}
