"use client";

import { useEffect, useState } from "react";
import { Header, Trademark } from "../SimpleGame";
import { feedHref } from "../../lib/gamePicker";
import {
  beforeAfter, isSwingsDoc, matchup, playText, points, situation, swingLine, top25, weekLabel, weeksNewestFirst,
  type Swing,
} from "../../lib/stories/swings";
import "./stories.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; weeks: Swing[]; top: Swing[] };

function SwingCard({ s }: { s: Swing }) {
  return (
    <article className="st-card">
      <p className="st-kicker">{weekLabel(s)} · {matchup(s)}</p>
      <p className="st-big">{swingLine(s)}</p>
      <p className="st-meta">{situation(s)}</p>
      <p className="st-text">{playText(s.desc)}</p>
      <p className="st-ba">{beforeAfter(s)}</p>
      <a className="st-oval" href={feedHref(s.game_id, BASE)}>See the game chart</a>
    </article>
  );
}

export function SwingStories() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [i, setI] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    fetch(`${BASE}/data/stories/swings.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!live) return;
        if (!isSwingsDoc(d)) throw new Error("shape");
        setLoad({ state: "ready", weeks: weeksNewestFirst(d.weeks), top: top25(d.top) });
      })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);

  return (
    <div className="sg-app st-app">
      <Header right="Swings" />
      <h1 className="st-h1">Swing of the Week</h1>
      <p className="st-sub">The one regulation play each week that moved a team&apos;s chance to win the most.</p>

      {load.state === "loading" ? (
        <div aria-busy="true" aria-label="Loading swings">
          <div className="st-skel" style={{ height: 210 }} />
          <div className="st-skel" />
          <div className="st-skel" />
        </div>
      ) : load.state === "error" ? (
        <div className="st-empty" role="alert">
          <p>Couldn&apos;t load the swings.</p>
          <button type="button" className="st-oval st-oval-fill" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      ) : load.weeks.length === 0 && load.top.length === 0 ? (
        <div className="st-empty"><p>No swings yet. Check back after this week&apos;s games.</p></div>
      ) : (
        <>
          {load.weeks.length ? (
            <section aria-label="Swing of the Week">
              <div className="st-weeknav">
                <button type="button" className="st-oval" disabled={i >= load.weeks.length - 1} onClick={() => setI(i + 1)} aria-label="Earlier week">‹ Earlier</button>
                <span className="st-weeklbl">{weekLabel(load.weeks[i])}</span>
                <button type="button" className="st-oval" disabled={i === 0} onClick={() => setI(i - 1)} aria-label="Later week">Later ›</button>
              </div>
              <SwingCard s={load.weeks[i]} />
            </section>
          ) : (
            <div className="st-empty"><p>No Swing of the Week yet this season.</p></div>
          )}

          <h2 className="st-h2">Biggest swings since 2019</h2>
          <p className="st-sub">Top 25 regulation plays. Overtime isn&apos;t counted.</p>
          {load.top.length ? (
            <ol className="st-list">
              {load.top.map((s, n) => (
                <li key={`${s.game_id}-${n}`} className="st-row">
                  <span className="st-rank">{n + 1}</span>
                  <div className="st-row-b">
                    <p className="st-meta">{weekLabel(s)} · {matchup(s)}</p>
                    <p className="st-row-t">{playText(s.desc)}</p>
                    <p className="st-row-s"><b>{points(s)} points</b> · {beforeAfter(s)}</p>
                    <a className="st-link" href={feedHref(s.game_id, BASE)}>Game chart</a>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="st-empty"><p>No swings to list yet.</p></div>
          )}
        </>
      )}
      <p className="st-src">Win chance from nflverse play-by-play.</p>
      <Trademark />
    </div>
  );
}
