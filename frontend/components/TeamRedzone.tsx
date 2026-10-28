"use client";

import { useState } from "react";
import { ALL, REDZONE, pct, rowFor, seasonKeys, sliceFor, vsLeague } from "../lib/teamRedzone";

export function TeamRedzone({ abbr }: { abbr: string }) {
  const [season, setSeason] = useState(ALL);
  const keys = seasonKeys();
  const slice = sliceFor(season);
  const row = rowFor(abbr, slice);
  const [s0, s1] = REDZONE.seasons;
  const when = season === ALL ? `${s0}–${s1}` : season;
  return (
    <>
      {keys.length ? (
        <div className="pf-chips tm-chips" role="group" aria-label="Season">
          {[ALL, ...keys].map((k) => (
            <button key={k} type="button" className={`pf-chip${season === k ? " is-on" : ""}`} aria-pressed={season === k} onClick={() => setSeason(k)}>
              {k === ALL ? "All" : k}
            </button>
          ))}
        </div>
      ) : null}
      {!row ? (
        <section className="tm-hero"><p className="tm-q">No red-zone trips for this team in {when}.</p></section>
      ) : (
        <section className="tm-hero" aria-live="polite">
          <h2 className="tm-q">Red-zone trips that ended in a touchdown</h2>
          <div className="tm-big">{pct(row.td_rate)}</div>
          <div className="tm-sub">{row.td.toLocaleString()} of {row.drives.toLocaleString()} trips, {when}</div>
          <p className="tm-vs">{vsLeague(row.td_rate, slice.league.td_rate)} ({pct(slice.league.td_rate)}) · #{row.rank} of {slice.teams.length}</p>
          <div className="tm-bars" aria-hidden="true">
            <div className="tm-row"><span>{abbr}</span><div className="tm-bar"><i style={{ width: pct(row.td_rate) }} /></div></div>
            <div className="tm-row"><span>NFL</span><div className="tm-bar tm-bar-lg"><i style={{ width: pct(slice.league.td_rate) }} /></div></div>
          </div>
          <ul className="tm-tiles">
            <li><span>Touchdown</span><b>{row.td.toLocaleString()}</b></li>
            <li><span>Field goal</span><b>{row.fg.toLocaleString()}</b></li>
            <li><span>No points</span><b>{row.no_score.toLocaleString()}</b></li>
          </ul>
        </section>
      )}
    </>
  );
}
