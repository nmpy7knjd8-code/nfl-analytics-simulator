"use client";

import { useState } from "react";
import { fgRates, bandsFor, bandIndexFor, bandLabel, FG_MAX_YARDS, FG_MIN_YARDS } from "../lib/fgRates";

const pctText = (p: number | null) => (p === null ? "—" : `${Math.round(p)}%`);

export function KickBands() {
  const [season, setSeason] = useState<string>("all");
  const [yards, setYards] = useState(45);
  const bands = bandsFor(fgRates, season);
  const active = bandIndexFor(fgRates, yards);
  const cur = bands[active];
  const options = ["all", ...fgRates.seasons.map(String)];

  return (
    <div className="kb">
      <section className="fd-card kb-hero" aria-live="polite">
        <label htmlFor="kb-yards" className="kb-q">
          From <strong>{yards} yards</strong>, real kicks went in
        </label>
        <div className="kb-big">{pctText(cur?.pct ?? null)}</div>
        <div className="kb-sub">
          {cur ? `${cur.made.toLocaleString()} of ${cur.tries.toLocaleString()} kicks from ${bandLabel(cur).toLowerCase()} yards` : ""}
          {cur?.few ? " · few kicks, rough number" : ""}
        </div>
        <input
          id="kb-yards"
          className="kb-range"
          type="range"
          min={FG_MIN_YARDS}
          max={FG_MAX_YARDS}
          step={1}
          value={yards}
          onChange={(e) => setYards(Number(e.target.value))}
        />
        <div className="kb-ends"><span>{FG_MIN_YARDS} yd</span><span>{FG_MAX_YARDS} yd</span></div>
      </section>

      <div className="kb-toggle" role="group" aria-label="Season">
        {options.map((o) => (
          <button key={o} type="button" className={`kb-pill${season === o ? " is-on" : ""}`} aria-pressed={season === o} onClick={() => setSeason(o)}>
            {o === "all" ? "All years" : o}
          </button>
        ))}
      </div>

      <ul className="kb-grid">
        {bands.map((b, i) => (
          <li key={b.id} className={`kb-tile${i === active ? " is-on" : ""}`}>
            <button type="button" onClick={() => setYards(Math.max(b.min, FG_MIN_YARDS))} aria-label={`${bandLabel(b)} yards: ${pctText(b.pct)} made`}>
              <span className="kb-tile-yd">{bandLabel(b)} yd</span>
              <span className="kb-tile-pct">{pctText(b.pct)}</span>
              <span className="kb-bar"><span style={{ width: `${b.pct ?? 0}%` }} /></span>
              <span className="kb-tile-n">{b.few ? "few kicks" : `${b.tries.toLocaleString()} kicks`}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="kb-note">
        In our game, kicks stop at {FG_MAX_YARDS} yards. Data: nflverse play-by-play, {fgRates.seasons[0]}–{fgRates.seasons[fgRates.seasons.length - 1]} seasons.
        {fgRates.stub ? " Preview numbers." : ""}
      </p>
    </div>
  );
}
