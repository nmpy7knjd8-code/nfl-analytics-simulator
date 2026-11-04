"use client";

import { useState } from "react";
import { fgRates, bandsFor, bandIndexFor, bandLabel, rateAt, FG_MAX_YARDS, FG_MIN_YARDS } from "../lib/fgRates";
import { Header, Trademark } from "./SimpleGame";

const pctText = (p: number | null) => (p === null ? "—" : `${Math.round(p)}%`);
const first = fgRates.seasons[0], last = fgRates.seasons[fgRates.seasons.length - 1];

export function KickBands() {
  const [season, setSeason] = useState<string>("all");
  const [yards, setYards] = useState(45);
  const bands = bandsFor(fgRates, season);
  const active = bandIndexFor(fgRates, yards);
  const at = rateAt(fgRates, season, yards);
  const options = ["all", ...fgRates.seasons.map(String)];
  const when = season === "all" ? `${first}–${last}` : season;

  return (
    <div className="sg-app kb">
      <Header right="Kicks" />
      <h1 className="kb-h1">How far can they kick?</h1>
      <p className="kb-lede">Drag the ball back and see how often real field goals went in from there.</p>

      <section className="kb-hero" aria-live="polite">
        <label htmlFor="kb-yards" className="kb-q">
          From <strong>{yards} yards</strong>, kicks went in
        </label>
        <div className="kb-big">{pctText(at.pct)}</div>
        <div className="kb-sub">
          {at.made.toLocaleString()} of {at.tries.toLocaleString()} kicks from {at.lo}–{at.hi} yards, {when}
          {at.few ? " · few kicks, rough number" : ""}
        </div>
        <input
          id="kb-yards" className="kb-range" type="range" min={FG_MIN_YARDS} max={FG_MAX_YARDS} step={1}
          value={yards} onChange={(e) => setYards(Number(e.target.value))}
        />
        <div className="kb-ends"><span>{FG_MIN_YARDS} yd</span><span>{FG_MAX_YARDS} yd</span></div>
      </section>

      <div className="pf-chips kb-chips" role="group" aria-label="Season">
        {options.map((o) => (
          <button key={o} type="button" className={`pf-chip${season === o ? " is-on" : ""}`} aria-pressed={season === o} onClick={() => setSeason(o)}>
            {o === "all" ? "All" : o}
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
              <span className="kb-tile-n">{b.made.toLocaleString()} of {b.tries.toLocaleString()}{b.few ? " · few kicks" : ""}</span>
            </button>
          </li>
        ))}
      </ul>

      <p className="kb-note">
        The big number pools every kick within {fgRates.smoothYards} yards of the slider. Kicks stop at {FG_MAX_YARDS} yards here.
        Data: nflverse play-by-play, {first}–{last}, regular season and playoffs.
      </p>
      <Trademark />
    </div>
  );
}
