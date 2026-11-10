"use client";

import { useEffect, useState } from "react";
import { Header, Trademark } from "../SimpleGame";
import { feedHref } from "../../lib/gamePicker";
import { isFirstDownDoc, isGood, outcomeText, pct, situation, weekSet, whyText, type Call, type FdPlay, type FirstDownDoc } from "../../lib/stories/firstDown";
import "./stories.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Load = { state: "loading" } | { state: "error" } | { state: "ready"; doc: FirstDownDoc; set: FdPlay[] };

export function FirstDown() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [n, setN] = useState(0);
  const [picks, setPicks] = useState<Call[]>([]);
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    fetch(`${BASE}/data/stories/firstdown.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!live) return;
        if (!isFirstDownDoc(d)) throw new Error("shape");
        setLoad({ state: "ready", doc: d, set: weekSet(d, new Date()) });
      })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);

  const body = () => {
    if (load.state === "loading") return <div aria-busy="true" aria-label="Loading first downs"><div className="st-skel" /><div className="st-skel" /></div>;
    if (load.state === "error") return (
      <div className="st-empty" role="alert">
        <p>Couldn&apos;t load this week&apos;s plays.</p>
        <button type="button" className="st-oval st-oval-fill" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
      </div>
    );
    const { doc, set } = load;
    if (!set.length) return <div className="st-empty"><p>No plays this week. Check back Monday.</p></div>;
    if (n >= set.length) {
      const right = set.filter((p, k) => picks[k] === p.call).length;
      return (
        <div className="st-card fd-end">
          <p className="fd-big">You read {right} of {set.length} calls</p>
          <ol className="st-list">
            {set.map((p, k) => (
              <li key={k} className="st-row"><div className="st-row-b">
                <p className="st-meta">{p.offense} vs {p.defense} · {p.season}</p>
                <p className="st-row-s">{picks[k] === p.call ? "✓" : "✗"} {outcomeText(p)} {isGood(p) ? "Good play." : "Not a good play."}</p>
                <a className="st-link" href={feedHref(p.gameId, BASE)}>Game chart</a>
              </div></li>
            ))}
          </ol>
          <p className="st-sub">New plays every Monday.</p>
        </div>
      );
    }
    const p = set[n], pick = picks[n];
    return (
      <div className="st-card">
        <p className="st-meta">Play {n + 1} of {set.length} · {p.offense} has the ball vs {p.defense}</p>
        <p className="fd-sit">{situation(p)}</p>
        {pick == null ? (
          <>
            <p className="fd-q">What did {p.offense} call?</p>
            <div className="fd-btns">
              {(["pass", "run"] as Call[]).map((c) => (
                <button key={c} type="button" className="st-oval" onClick={() => setPicks((a) => { const b = [...a]; b[n] = c; return b; })}>{c === "pass" ? "Pass" : "Run"}</button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="fd-q">{pick === p.call ? "Right." : "Not this time."} {p.offense} called a {p.call}.</p>
            <p className="fd-out"><b>{outcomeText(p)}</b> {isGood(p) ? "A good play." : "Not a good play."}</p>
            <p className="st-row-s">{whyText(p)}</p>
            <p className="st-row-s">Since 2019 on 1st & 10, passes were good {pct(doc.league.pass.good)} of the time, runs {pct(doc.league.run.good)}.</p>
            <button type="button" className="st-oval st-oval-fill" onClick={() => setN(n + 1)}>{n + 1 < set.length ? "Next play" : "See how you did"}</button>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="sg-app st-app">
      <Header right="First down" />
      <h1 className="st-h1">First down</h1>
      <p className="st-sub">Five real 1st & 10 plays a week. Guess the call. A good play gains 4+ yards, a first down or a touchdown, with no turnover.</p>
      {body()}
      <p className="st-src">Plays from nflverse play-by-play.</p>
      <Trademark />
    </div>
  );
}
