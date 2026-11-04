"use client";

import { useEffect, useState } from "react";
import { feedHref } from "../../lib/gamePicker";
import { dayLabel, games, isOnThisDayDoc, mmdd, pickDay, scoreLine, type DayGame } from "../../lib/stories/onThisDay";
import "./stories.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Load = { state: "loading" } | { state: "error" } | { state: "none" } | { state: "ready"; label: string; list: DayGame[] };

/** Self-contained "On this day" card. Integration owns where it mounts. `date` is for previews/tests. */
export function OnThisDay({ date, max = 5 }: { date?: Date; max?: number }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    fetch(`${BASE}/data/stories/onthisday.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!live) return;
        if (!isOnThisDayDoc(d)) throw new Error("shape");
        const p = pickDay(d, mmdd(date ?? new Date()));
        if (!p) return setLoad({ state: "none" });
        setLoad({ state: "ready", label: p.exact ? `On this day, ${dayLabel(p.key)}` : `Nearest game day, ${dayLabel(p.key)}`, list: games(d, p.key).slice(0, max) });
      })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt, date, max]);

  return (
    <section className="st-card otd" aria-label="On this day">
      {load.state === "loading" ? (
        <div aria-busy="true" aria-label="Loading on this day"><div className="st-skel" /><div className="st-skel" /></div>
      ) : load.state === "error" ? (
        <div className="st-empty" role="alert">
          <p>Couldn&apos;t load on this day.</p>
          <button type="button" className="st-oval st-oval-fill" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      ) : load.state === "none" ? (
        <div className="st-empty"><p>No games on this day. Football is back in September.</p></div>
      ) : (
        <>
          <p className="otd-h">{load.label}</p>
          <ul className="st-list">
            {load.list.map((g) => (
              <li key={g.gameId} className="st-row">
                <div className="st-row-b">
                  <p className="st-meta">{g.year}</p>
                  <p className="st-row-t"><b>{scoreLine(g)}</b></p>
                  <a className="st-link" href={feedHref(g.gameId, BASE)}>Game chart</a>
                </div>
              </li>
            ))}
          </ul>
          <p className="st-src">Final scores from nflverse play-by-play.</p>
        </>
      )}
    </section>
  );
}
