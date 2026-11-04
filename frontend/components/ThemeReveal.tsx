"use client";

import { useEffect, useState } from "react";
import type { ThemeDay, ThemeId, ThemePackItem } from "../contracts/themePacks";
import { dateKey } from "../lib/daily";
import schedule from "../lib/themeSchedule.json";
import { CALL_LABEL, THEME_LINE, THEME_NAME, calls, coachLine, matchedCoach, situationLine, themeFact, themedSet, type Call } from "../lib/themeReveal";
import { teamLogo } from "./ScoreBug";
import { Header, Trademark } from "./SimpleGame";

const loadPack = (t: ThemeId): Promise<{ items: ThemePackItem[] }> =>
  t === "goal-line" ? import("../public/data/packs/goal-line.json") as never
    : t === "playoffs" ? import("../public/data/packs/playoffs.json") as never
    : import("../public/data/packs/marathon.json") as never;

type Load = { state: "loading" } | { state: "error" } | { state: "none" } | { state: "ready"; theme: ThemeId; set: ThemePackItem[] };

function Shell({ right, children, cls = "" }: { right: string; children: React.ReactNode; cls?: string }) {
  return <div className={`sg-app tr ${cls}`}><Header right={right} />{children}<Trademark /></div>;
}

export function ThemeReveal() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [picks, setPicks] = useState<Call[]>([]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let live = true;
    const day = (schedule.days as Record<string, ThemeDay>)[dateKey()];
    if (!day) { setLoad({ state: "none" }); return; }
    setLoad({ state: "loading" });
    loadPack(day.theme)
      .then((m) => {
        const set = themedSet(day, ((m as { default?: { items: ThemePackItem[] } }).default ?? m).items);
        if (live) setLoad(set ? { state: "ready", theme: day.theme, set } : { state: "error" });
      })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);

  if (load.state === "loading") return <Shell right="Bonus 5"><div className="sg-status" role="status"><span className="sg-spin" aria-hidden="true" /><p>Loading today&rsquo;s bonus plays…</p></div></Shell>;
  if (load.state === "error") return (
    <Shell right="Bonus 5"><div className="sg-status" role="alert"><p>Couldn&rsquo;t load the bonus plays. Try again.</p>
      <button type="button" className="sg-next" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div></Shell>);
  if (load.state === "none") return (
    <Shell right="Bonus 5"><div className="sg-status" role="status"><p>No bonus plays today.</p>
      <a className="sg-next tr-link" href="#" onClick={(e) => { e.preventDefault(); history.replaceState(null, "", location.pathname); dispatchEvent(new HashChangeEvent("hashchange")); }}>Play today&rsquo;s 5</a></div></Shell>);

  const { theme, set } = load;
  const n = set.length;

  if (idx >= n) {
    const right = set.filter((i, k) => matchedCoach(i, picks[k])).length;
    return (
      <Shell right="Bonus 5" cls="sg-end">
        <div className="sg-lbl sg-center">Today&rsquo;s hidden theme</div>
        <section className="tr-reveal" aria-live="polite">
          <h1 className="tr-name">{THEME_NAME[theme]}</h1>
          <p className="tr-line">{THEME_LINE[theme]}</p>
        </section>
        <div className="sg-recap">
          {set.map((i, k) => (
            <div key={i.id} className={matchedCoach(i, picks[k]) ? "sg-y" : "sg-n"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={teamLogo(i.situation.posteam)} alt="" width={22} height={22} className="sg-plate" />
              <span><strong>{i.source.season}</strong> · {themeFact(theme, i)}</span>
            </div>
          ))}
        </div>
        <p className="tr-score">You matched the coach on {right} of {n}.</p>
        <a className="sg-next tr-link" href="#" onClick={(e) => { e.preventDefault(); history.replaceState(null, "", location.pathname); dispatchEvent(new HashChangeEvent("hashchange")); }}>Back to today&rsquo;s 5</a>
      </Shell>
    );
  }

  const item = set[idx];
  const pick = picks[idx];
  const counter = `${idx + 1} of ${n}`;
  const card = (
    <section className="fp-card tr-card">
      <div className="fp-team">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={teamLogo(item.situation.posteam)} alt="" width={36} height={36} className="sg-plate" />
        <span>{item.source.season}</span>
      </div>
      <p className="sg-sent">{situationLine(item)}</p>
    </section>
  );
  if (pick === undefined) return (
    <Shell right={counter}>
      <h1 className="fp-h1">Bonus 5: what&rsquo;s the call?</h1>
      {card}
      <p className="tr-hint">These 5 share a hidden theme. It&rsquo;s revealed after play 5.</p>
      <div className="sg-btns">
        {calls(item).map((c) => <button key={c} type="button" className="sg-btn sg-btn-c" onClick={() => setPicks([...picks, c])}>{CALL_LABEL[c]}</button>)}
      </div>
    </Shell>
  );
  const ok = matchedCoach(item, pick);
  return (
    <Shell right={counter} cls={`sg-rv ${ok ? "sg-ok" : "sg-no"}`}>
      <h1 className="sg-verdict" aria-live="polite"><span className="sg-glyph" aria-hidden="true">{ok ? "✓" : "✗"}</span>{ok ? "You matched the coach" : "Not the coach's call"}</h1>
      {card}
      <div className="sg-res">
        <div className="sg-ln"><div className="sg-lbl">You said</div><div className="sg-v">{CALL_LABEL[pick]}</div></div>
        <div className="sg-ln"><div className="sg-lbl">Coach</div><div className="sg-v">{coachLine(item)}</div></div>
      </div>
      <div className="sg-btns">
        <button type="button" className="sg-next" onClick={() => setIdx(idx + 1)}>{idx + 1 < n ? "Next play" : "Reveal the theme"}</button>
      </div>
    </Shell>
  );
}
