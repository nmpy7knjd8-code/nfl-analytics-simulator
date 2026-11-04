"use client";

import { useEffect, useState } from "react";
import { DAILY_ITEMS, shortDate } from "../lib/daily";
import { coachTally, loadCoach, verdictText, type CoachEntry } from "../lib/coachTally";
import { CHOICE_LABEL, isGoalToGo } from "../lib/simpleGame";

const BY_ID = new Map(DAILY_ITEMS.map((i) => [i.id, i]));

/** A2 Coach vs. You on the stats page: tally + your disagreements with a plain verdict. */
export function CoachRecord() {
  const [es, setEs] = useState<CoachEntry[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let st: Storage | undefined;
    try { st = window.localStorage; } catch { st = undefined; }
    setEs(loadCoach(st));
  }, []);
  return (
    <section id="coach" className="cv-card" aria-labelledby="cv-h">
      <h2 id="cv-h">You vs. the coaches</h2>
      {es == null ? <p className="sg-note" role="status">Loading…</p> : es.length === 0 ? (
        <p>Play today&apos;s five to start your record against real coaches.</p>
      ) : (
        <>
          <p className="cv-tally">Same call: <b>{coachTally(es).agreed}</b> · Different: <b>{coachTally(es).differed}</b></p>
          <p className="sg-note cv-note">Counts plays where the coach&apos;s call is known</p>
          {coachTally(es).differed ? (
            <button type="button" className="cv-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              Where you disagreed
            </button>
          ) : null}
          {open ? (
            <div className="cv-sheet" role="dialog" aria-modal="true" aria-label="Where you disagreed">
              <div className="cv-sheet-in">
                <div className="cv-sheet-h"><h3>Where you disagreed</h3><button type="button" className="cv-close" onClick={() => setOpen(false)} aria-label="Close">✕</button></div>
            <ul className="cv-list">
              {es.filter((e) => e.pick !== e.coach).slice().reverse().map((e) => {
                const it = BY_ID.get(e.id);
                return (
                  <li key={`${e.date}-${e.id}`}>
                    <div className="cv-top">{shortDate(e.date)}{it ? ` · ${it.situation.posteam} 4th & ${isGoalToGo(it) ? "Goal" : it.situation.distance}` : ""}</div>
                    <div>You: <b>{CHOICE_LABEL[e.pick]}</b> · Coach: <b>{CHOICE_LABEL[e.coach]}</b></div>
                    <div className="cv-v">{verdictText(e)}</div>
                  </li>
                );
              })}
            </ul>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
