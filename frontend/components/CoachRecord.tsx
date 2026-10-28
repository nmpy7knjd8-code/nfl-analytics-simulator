"use client";

import { useEffect, useState } from "react";
import { DAILY_ITEMS, shortDate } from "../lib/daily";
import { coachTally, loadCoach, verdictText, type CoachEntry } from "../lib/coachTally";
import { CHOICE_LABEL, isGoalToGo } from "../lib/simpleGame";

const BY_ID = new Map(DAILY_ITEMS.map((i) => [i.id, i]));

/** Tick marks, five to a bundle. */
function Ticks({ n, label }: { n: number; label: string }) {
  const groups = Array.from({ length: Math.ceil(n / 5) }, (_, g) => Math.min(5, n - g * 5));
  return (
    <div className="cv-row">
      <span className="cv-lbl">{label}</span>
      <span className="cv-ticks" aria-label={`${label}: ${n}`}>
        {groups.length ? groups.map((k, g) => <span key={g} className="cv-bundle">{"|".repeat(k)}</span>) : <span className="cv-zero">0</span>}
        <b>{n}</b>
      </span>
    </div>
  );
}

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
      {es == null ? <p className="fd-muted" role="status">Loading…</p> : es.length === 0 ? (
        <p>Play today&apos;s five to start your record against real coaches.</p>
      ) : (
        <>
          <Ticks n={coachTally(es).agreed} label="Agreed" />
          <Ticks n={coachTally(es).differed} label="Didn't" />
          {coachTally(es).differed ? (
            <button type="button" className="cv-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Hide" : "Show"} where you disagreed
            </button>
          ) : null}
          {open ? (
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
          ) : null}
        </>
      )}
    </section>
  );
}
