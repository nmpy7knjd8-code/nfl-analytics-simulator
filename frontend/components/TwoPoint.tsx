"use client";
import type React from "react";

import { useCallback, useEffect, useState } from "react";
import { dateKey } from "../lib/daily";
import {
  CALL_LABEL, buildRound, readKicks, coachText, otherTriesNote, pct1, ratesLines, readTries, sameAsCoach, shareText, situationText,
  type Call, type Try, type TwoPointFile,
} from "../lib/twoPoint";
import { teamLogo } from "./ScoreBug";
import { Header, Trademark } from "./SimpleGame";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; file: TwoPointFile; tries: Try[]; kicks: Try[] };
const TITLE = "Go for two?";

function Status({ children, alert }: { children: React.ReactNode; alert?: boolean }) {
  return (
    <div className="sg-app tp">
      <Header right={TITLE} />
      <div className="sg-status" role={alert ? "alert" : "status"}>{children}</div>
      <Trademark />
    </div>
  );
}

export function TwoPoint() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [seed, setSeed] = useState<string | null>(null);
  const [cards, setCards] = useState<Try[]>([]);
  const [idx, setIdx] = useState(0);
  const [calls, setCalls] = useState<Call[]>([]);
  const [going, setGoing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    import("../lib/site/twopoint.json")
      .then((m) => {
        const file = (m.default ?? m) as unknown as TwoPointFile;
        if (live) setLoad({ state: "ready", file, tries: readTries(file), kicks: readKicks(file) });
      })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);
  useEffect(() => { setSeed(dateKey()); }, []);
  useEffect(() => {
    if (load.state === "ready" && seed) { setCards(buildRound(load.tries, seed, undefined, load.kicks)); setIdx(0); setCalls([]); setGoing(false); setCopied(false); }
  }, [load, seed]);
  const again = useCallback(() => setSeed(String(Date.now())), []);
  const pick = (c: Call) => { setCalls([...calls, c]); setGoing(false); };

  if (load.state === "loading" || (load.state === "ready" && seed == null)) {
    return <Status><span className="sg-spin" aria-hidden="true" /><p>Loading tries…</p></Status>;
  }
  if (load.state === "error") {
    return (
      <Status alert>
        <p>Couldn&rsquo;t load the tries. Try again.</p>
        <button type="button" className="sg-next" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
      </Status>
    );
  }
  if (cards.length === 0) return <Status><p>No tries to show yet.</p></Status>;

  const file = load.file;
  const tp = file.two_point, xp = file.extra_point;
  const n = cards.length;

  if (idx >= n) {
    const results = cards.map((t, i) => sameAsCoach(t, calls[i]));
    const share = shareText(results);
    return (
      <div className="sg-app sg-end tp">
        <Header right={TITLE} />
        <div className="sg-lbl sg-center">Same call as the coach</div>
        <div className="sg-big">{results.filter(Boolean).length}/{n}</div>
        <div className="sg-recap">
          {cards.map((t, i) => (
            <div key={i} className={results[i] ? "sg-y" : "sg-n"}>
              <b aria-label={results[i] ? "Same call" : "Different call"}>{results[i] ? "=" : "≠"}</b>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={teamLogo(t.team)} alt="" width={22} height={22} className="sg-plate" />
              <span><strong>{t.team}</strong> · {t.kind === "extra_point" ? "kick" : t.kind} · {t.made ? "good" : "no good"}</span>
              <span className="sg-c">You: {calls[i] === "kick" ? "Kick" : calls[i] === "run" ? "Run" : "Pass"}</span>
            </div>
          ))}
        </div>
        <pre className="sg-share">{share}</pre>
        <div className="tp-row">
          <button type="button" className="sg-next" onClick={async () => {
            try {
              if (navigator.share) await navigator.share({ text: share });
              else { await navigator.clipboard.writeText(share); setCopied(true); }
            } catch { /* dismissed */ }
          }}>{copied ? "Copied" : "Share"}</button>
          <button type="button" className="sg-keep" onClick={again}>Play again</button>
        </div>
        <Trademark />
      </div>
    );
  }

  const t = cards[idx];
  const call = calls[idx];
  const counter = `${idx + 1} of ${n}`;
  const where = `${t.season} ${t.season_type === "POST" ? "playoffs" : `week ${t.week}`} · ${t.team} vs ${t.opp}`;

  if (call === undefined) {
    return (
      <div className="sg-app tp">
        <Header right={counter} />
        <h1 className="tp-h1">Kick or go for two?</h1>
        <section className="tp-card">
          <div className="tp-team">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogo(t.team)} alt="" width={36} height={36} className="sg-plate" />
            <span>{where}</span>
          </div>
          <p className="sg-sent">{situationText(t)}</p>
        </section>
        <div className="sg-btns">
          {going ? (
            <>
              <p className="sg-note">Run or pass?</p>
              <button type="button" className="sg-btn" onClick={() => pick("run")}>Run<small>good {pct1(tp.run)}</small></button>
              <button type="button" className="sg-btn" onClick={() => pick("pass")}>Pass<small>good {pct1(tp.pass)}</small></button>
              <button type="button" className="sg-keep" onClick={() => setGoing(false)}>Back</button>
            </>
          ) : (
            <>
              <button type="button" className="sg-btn" onClick={() => pick("kick")}>Kick for 1<small>good {pct1(xp)}</small></button>
              <button type="button" className="sg-btn" onClick={() => setGoing(true)}>Go for 2<small>good {pct1(tp)}</small></button>
            </>
          )}
        </div>
        <Trademark />
      </div>
    );
  }

  const same = sameAsCoach(t, call);
  return (
    <div className={`sg-app sg-rv tp ${same ? "sg-ok" : "sg-half"}`}>
      <Header right={counter} />
      <h1 className="sg-verdict" aria-live="polite"><span className="sg-glyph" aria-hidden="true">{same ? "=" : "≠"}</span>{same ? "Same as the coach" : "Coach went another way"}</h1>
      <div className="sg-res">
        <div className="sg-ln"><div className="sg-lbl">You picked</div><div className="sg-v">{CALL_LABEL[call]}</div></div>
        <div className="sg-ln"><div className="sg-lbl">The {t.team} coach</div><div className="sg-v">{coachText(t)}</div></div>
      </div>
      <ul className="tp-rates" aria-label={`Real rates, ${file.season_list[0]}–${file.season_list[file.season_list.length - 1]}`}>
        {ratesLines(file).map((l) => <li key={l}>{l}</li>)}
      </ul>
      {otherTriesNote(file) && <p className="tp-note tp-other">{otherTriesNote(file)}</p>}
      <p className="tp-note">Real league rates since {file.season_list[0]}, not a pick for this spot.</p>
      <div className="sg-btns">
        <button type="button" className="sg-next" onClick={() => setIdx(idx + 1)}>{idx + 1 < n ? "Next try" : "See your score"}</button>
      </div>
      <Trademark />
    </div>
  );
}
