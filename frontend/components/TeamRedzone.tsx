"use client";

import { useState } from "react";
import { ALL, REDZONE, pct, rowFor, seasonKeys, sliceFor, vsLeague } from "../lib/teamRedzone";
import { CLOSE_LINE, VIEW_LABEL, gtView, teamStats, yardsVsLeague, type View } from "../lib/teamGarbageTime";

export function TeamRedzone({ abbr }: { abbr: string }) {
  const [season, setSeason] = useState(ALL);
  const [view, setView] = useState<View>("all");
  const keys = seasonKeys();
  const slice = sliceFor(season);
  const row = rowFor(abbr, slice);
  const [s0, s1] = REDZONE.seasons;
  const when = season === ALL ? `${s0}–${s1}` : season;
  const gv = gtView(view, season);
  const st = gv ? teamStats(abbr, gv) : undefined;
  const close = view === "close";
  return (
    <>
      <div className="tm-toggle" role="group" aria-label="Which plays">
        {(["all", "close"] as const).map((v) => (
          <button key={v} type="button" className={`tm-pill${view === v ? " is-on" : ""}`} aria-pressed={view === v} onClick={() => setView(v)}>
            {VIEW_LABEL[v]}
          </button>
        ))}
      </div>
      <p className="tm-def">{CLOSE_LINE}</p>
      {keys.length ? (
        <div className="pf-chips tm-chips" role="group" aria-label="Season">
          {[ALL, ...keys].map((k) => (
            <button key={k} type="button" className={`pf-chip${season === k ? " is-on" : ""}`} aria-pressed={season === k} onClick={() => setSeason(k)}>
              {k === ALL ? "All" : k}
            </button>
          ))}
        </div>
      ) : null}
      {close ? (
        !st ? (
          <section className="tm-hero"><p className="tm-q">No close-game red-zone trips for this team in {when}.</p></section>
        ) : (
          <section className="tm-hero" aria-live="polite">
            <h2 className="tm-q">Red-zone trips that ended in a touchdown, close games</h2>
            <div className="tm-big">{pct(st.rz.rate)}</div>
            <div className="tm-sub">{st.rz.td.toLocaleString()} of {st.rz.trips.toLocaleString()} trips, {when}</div>
            <p className="tm-vs">{vsLeague(st.rz.rate, st.rz.league)} ({pct(st.rz.league)}) · #{st.rz.rank} of {st.teams}</p>
            <div className="tm-bars" aria-hidden="true">
              <div className="tm-row"><span>{abbr}</span><div className="tm-bar"><i style={{ width: pct(st.rz.rate) }} /></div></div>
              <div className="tm-row"><span>NFL</span><div className="tm-bar tm-bar-lg"><i style={{ width: pct(st.rz.league) }} /></div></div>
            </div>
          </section>
        )
      ) : !row ? (
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
      {st ? (
        <ul className="tm-stats" aria-live="polite">
          <li>
            <span>Yards per play</span>
            <b>{st.ypp.rate.toFixed(2)}</b>
            <small>{yardsVsLeague(st.ypp.rate, st.ypp.league)} ({st.ypp.league.toFixed(2)}) · #{st.ypp.rank} of {st.teams}</small>
            <small>{st.ypp.plays.toLocaleString()} runs and passes</small>
          </li>
          <li>
            <span>Third downs converted</span>
            <b>{pct(st.third.rate)}</b>
            <small>{vsLeague(st.third.rate, st.third.league)} ({pct(st.third.league)}) · #{st.third.rank} of {st.teams}</small>
            <small>{st.third.conv.toLocaleString()} of {st.third.att.toLocaleString()}</small>
          </li>
        </ul>
      ) : null}
    </>
  );
}
