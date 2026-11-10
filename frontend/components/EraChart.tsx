"use client";

import { useEffect, useState } from "react";
import { era, goRate, type EraZoneId } from "../lib/era";
import {
  CHART_HEIGHT,
  CSS_VARS,
  TAP_TARGET_MIN,
  chartMotionMs,
  grid as gridStyle,
  line as lineStyle,
  seriesColorSchemeCss,
  tooltip as tipStyle,
} from "../lib/chartStyle";
import { ChipScroll } from "./ChipScroll";
import { Header, Trademark } from "./SimpleGame";
import "./era-chart.css";

const W = 358, H = CHART_HEIGHT[390], L = 30, R = 16, T = 12, B = 26, YMAX = 40;
const SERIES = [0, 1, 3] as const; // accent, blue tint, gray — never team colors
const fmt = (p: number | null) => (p === null ? "—" : `${Math.round(p)}%`);
const stroke = (i: number) => `var(--chart-series-${SERIES[i] + 1})`;

export function EraChart() {
  const seasons = era.seasons;
  const [sel, setSel] = useState(seasons.length - 1);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const motionMs = chartMotionMs(reduceMotion);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(seasons.length - 1, 1);
  const y = (p: number) => T + (1 - p / YMAX) * (H - T - B);
  const cur = seasons[sel];
  const gridVals = [0, 10, 20, 30, 40];
  const hit = TAP_TARGET_MIN;

  return (
    <div className="sg-app kb ch-era">
      <style>{seriesColorSchemeCss(".ch-era")}</style>
      <Header right="4th downs" />
      <h1 className="kb-h1">Going for it, then and now</h1>
      <p className="kb-lede">How often NFL teams went for it on 4th down, season by season. Tap a season.</p>
      <section className="kb-hero ch-card era-plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="How often teams went for it on 4th down, by season and field zone">
          {gridVals.map((v) => (
            <g key={v}>
              <line
                x1={L} x2={W - R} y1={y(v)} y2={y(v)}
                stroke={`var(${CSS_VARS.gridline})`}
                strokeWidth={gridStyle.strokeWidth}
              />
              <text x={L - 6} y={y(v) + 4} textAnchor="end" className="era-ax">{v}%</text>
            </g>
          ))}
          {era.zones.map((z, zi) => {
            const pts = seasons.map((s, i) => [x(i), y(goRate(s[z.id]) ?? 0)] as const);
            const color = stroke(zi);
            return (
              <g key={z.id}>
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth={lineStyle.strokeWidth}
                  strokeLinecap={lineStyle.lineCap}
                  strokeLinejoin={lineStyle.lineJoin}
                  points={pts.map((p) => p.join(",")).join(" ")}
                />
                {pts.map(([px, py], i) => (
                  <circle
                    key={i}
                    cx={px}
                    cy={py}
                    r={i === sel ? 4.5 : 2.5}
                    fill={color}
                    style={{ transitionDuration: `${motionMs}ms` }}
                  />
                ))}
              </g>
            );
          })}
          {seasons.map((s, i) => (
            <text key={s.season} x={x(i)} y={H - 8} textAnchor="middle" className={`era-ax${i === sel ? " is-on" : ""}`}>{`'${String(s.season).slice(2)}`}</text>
          ))}
          {seasons.map((s, i) => (
            <rect
              key={s.season}
              x={x(i) - hit / 2}
              y={0}
              width={hit}
              height={H}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onClick={() => setSel(i)}
              aria-hidden="true"
            />
          ))}
        </svg>
        <div
          className={`era-tip${sel >= seasons.length - 2 ? " is-end" : ""}`}
          role="status"
          style={{
            left: `${(x(sel) / W) * 100}%`,
            transitionDuration: `${motionMs}ms`,
            borderRadius: tipStyle.borderRadius,
            boxShadow: tipStyle.shadow,
            backdropFilter: `blur(${tipStyle.backdropBlurPx}px)`,
            WebkitBackdropFilter: `blur(${tipStyle.backdropBlurPx}px)`,
          }}
        >
          <div className="era-tip-k">{cur.season}</div>
          <ul className="era-tip-rows">
            {era.zones.map((z, zi) => (
              <li key={z.id}>
                <span className="era-dot" style={{ background: stroke(zi) }} />
                {z.short}
                <strong>{fmt(goRate(cur[z.id as EraZoneId]))}</strong>
              </li>
            ))}
          </ul>
        </div>
        <ChipScroll>
          <div className="pf-chips ch-chips" role="group" aria-label="Season">
            {seasons.map((s, i) => (
              <button key={s.season} type="button" className={`pf-chip${i === sel ? " is-on" : ""}`} aria-pressed={i === sel} onClick={() => setSel(i)}>{s.season}</button>
            ))}
          </div>
        </ChipScroll>
      </section>

      <section className="kb-hero ch-pick" aria-live="polite">
        <div className="era-pick-h">In {cur.season}, teams went for it on</div>
        <ul className="era-rows">
          {era.zones.map((z, zi) => (
            <li key={z.id}><span className="era-dot" style={{ background: stroke(zi) }} />{z.label}<strong>{fmt(goRate(cur[z.id]))}</strong></li>
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
