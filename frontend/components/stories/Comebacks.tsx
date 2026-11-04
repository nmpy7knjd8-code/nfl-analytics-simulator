"use client";

import { useEffect, useState } from "react";
import { Header, Trademark } from "../SimpleGame";
import { feedHref } from "../../lib/gamePicker";
import { headline, isComebacksDoc, lowText, rows, scoreText, sparkPath, weekText, type Comeback } from "../../lib/stories/comebacks";
import "./stories.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Load = { state: "loading" } | { state: "error" } | { state: "ready"; head: string; list: Comeback[] };

function Spark({ c }: { c: Comeback }) {
  const W = 120, H = 32;
  return (
    <svg className="cb-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${c.winner} chance to win through regulation`}>
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="#d9d9d9" strokeDasharray="3 3" />
      <path d={sparkPath(c.spark, W, H)} fill="none" stroke="#1E5BFF" strokeWidth="2" />
    </svg>
  );
}

export function Comebacks() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    fetch(`${BASE}/data/stories/comebacks.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!live) return;
        if (!isComebacksDoc(d)) throw new Error("shape");
        setLoad({ state: "ready", head: headline(d), list: rows(d) });
      })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);

  return (
    <div className="sg-app st-app">
      <Header right="Comebacks" />
      <h1 className="st-h1">Biggest comebacks</h1>
      <p className="st-sub">Games won by a team that looked done. Lowest chance to win is from regulation only.</p>
      {load.state === "loading" ? (
        <div aria-busy="true" aria-label="Loading comebacks"><div className="st-skel" /><div className="st-skel" /><div className="st-skel" /></div>
      ) : load.state === "error" ? (
        <div className="st-empty" role="alert">
          <p>Couldn&apos;t load the comebacks.</p>
          <button type="button" className="st-oval st-oval-fill" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      ) : load.list.length === 0 ? (
        <div className="st-empty"><p>No comebacks yet. Check back after this week&apos;s games.</p></div>
      ) : (
        <>
          <p className="st-card cb-head">{load.head}</p>
          <ol className="st-list">
            {load.list.map((c, n) => (
              <li key={c.gameId} className="st-row">
                <span className="st-rank">{n + 1}</span>
                <div className="st-row-b">
                  <p className="st-meta">{weekText(c)}</p>
                  <p className="st-row-t"><b>{scoreText(c)}</b></p>
                  <p className="st-row-s">{lowText(c)}</p>
                  <Spark c={c} />
                  <a className="st-link" href={feedHref(c.gameId, BASE)}>Game chart</a>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="st-src">Win chance from nflverse play-by-play.</p>
      <Trademark />
    </div>
  );
}
