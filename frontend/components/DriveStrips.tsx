"use client";

import { useEffect, useState } from "react";
import { TILE_LABEL, TILE_ORDER, driveAria, drivesUrl, gameDrives, isDrivesFile, playsLabel, qtrLabel, resultLabel, yardsLabel, type Drive } from "../lib/drives";
import { teamNickname } from "../lib/teams";
import { TeamLogo } from "./TeamLogo";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; drives: Drive[]; dataThrough: string };

/** F7: one strip per drive, one tile per snap, shaded by what the play did. No win chance, so overtime drives show like any other. */
export function DriveStrips({ gameId, basePath }: { gameId: string; basePath: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: "loading" });
    fetch(drivesUrl(Number(gameId.slice(0, 4)), basePath), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((doc: unknown) => {
        if (!isDrivesFile(doc)) throw new Error("bad file");
        setLoad({ state: "ready", drives: gameDrives(doc, gameId), dataThrough: doc.dataThrough });
      })
      .catch((e: unknown) => { if ((e as Error)?.name !== "AbortError") setLoad({ state: "error" }); });
    return () => ctrl.abort();
  }, [gameId, basePath]);

  if (load.state === "loading") return <p className="pf-status" aria-live="polite">Loading drives…</p>;
  if (load.state === "error" || !load.drives.length) return <div className="pf-empty" role="alert"><p><b>No drives for this game.</b></p></div>;
  const ds = load.drives;
  return (
    <section className="ds" aria-label="Drives">
      <p className="pf-status">{ds.length} drives · one square per play</p>
      <ul className="ds-key" aria-label="Square colors">
        {TILE_ORDER.map((t) => <li key={t}><span className={`ds-t ds-${t}`} aria-hidden="true" />{TILE_LABEL[t]}</li>)}
      </ul>
      <ol className="ds-list">
        {ds.map((d, i) => {
          const newQ = i === 0 || ds[i - 1].qtr !== d.qtr;
          return (
            <li key={i} className={newQ ? "ds-q" : undefined} aria-label={driveAria(d, teamNickname)}>
              {newQ ? <div className="ds-qh" aria-hidden="true">{d.qtr > 4 ? "Overtime" : `Quarter ${d.qtr}`}</div> : null}
              <div className="ds-row" aria-hidden="true">
                <div className="ds-top">
                  <TeamLogo abbr={d.team} size={18} />
                  <b>{teamNickname(d.team)}</b>
                  <span className="ds-when">{qtrLabel(d.qtr)} {d.clock}</span>
                  <span className={`ds-res${d.result === "TD" || d.result === "FG" ? " is-score" : ""}`}>{resultLabel(d.result, d.qtr)}</span>
                </div>
                <div className="ds-tiles">
                  {d.tiles.map((t, j) => <span key={j} className={`ds-t ds-${t}`} title={TILE_LABEL[t]} />)}
                </div>
                <div className="ds-sub">{playsLabel(d.tiles.length)} · {yardsLabel(d.yards)}</div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="kb-note">Each square is one snap, in order. Data: nflverse play-by-play. Data through {load.dataThrough}.</p>
    </section>
  );
}
