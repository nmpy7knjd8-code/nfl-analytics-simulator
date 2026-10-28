"use client";

import { useCallback, useEffect, useState } from "react";
import { dateKey } from "../lib/daily";
import { buildRound, isCorrect, plainDesc, ratesText, shareText, situationText, whyText, type Card, type FakesFile, type Guess } from "../lib/fakePunt";
import { teamLogo } from "./ScoreBug";
import { Header, Trademark } from "./SimpleGame";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; file: FakesFile };

export function FakePunt() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [seed, setSeed] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    setLoad({ state: "loading" });
    import("../lib/site/fakes.json")
      .then((m) => live && setLoad({ state: "ready", file: (m.default ?? m) as unknown as FakesFile }))
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);
  useEffect(() => { setSeed(dateKey()); }, []);
  useEffect(() => {
    if (load.state === "ready" && seed) { setCards(buildRound(load.file, seed)); setIdx(0); setGuesses([]); setCopied(false); }
  }, [load, seed]);
  const again = useCallback(() => setSeed(String(Date.now())), []);

  if (load.state === "loading" || (load.state === "ready" && seed == null)) {
    return (
      <div className="sg-app fp">
        <Header right="Real or fake?" />
        <div className="sg-status" role="status"><span className="sg-spin" aria-hidden="true" /><p>Loading punts…</p></div>
        <Trademark />
      </div>
    );
  }
  if (load.state === "error") {
    return (
      <div className="sg-app fp">
        <Header right="Real or fake?" />
        <div className="sg-status" role="alert">
          <p>Couldn&rsquo;t load the punts. Try again.</p>
          <button type="button" className="sg-next" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
        <Trademark />
      </div>
    );
  }
  const file = load.file;
  if (cards.length === 0) {
    return (
      <div className="sg-app fp">
        <Header right="Real or fake?" />
        <div className="sg-status" role="status"><p>No punts to show yet.</p></div>
        <Trademark />
      </div>
    );
  }

  const n = cards.length;
  if (idx >= n) {
    const results = cards.map((c, i) => isCorrect(c, guesses[i]));
    const right = results.filter(Boolean).length;
    const share = shareText(results, right);
    return (
      <div className="sg-app sg-end fp">
        <Header right="Real or fake?" />
        <div className="sg-lbl sg-center">Real punt or fake?</div>
        <div className="sg-big">{right}/{n}</div>
        <div className="sg-marks" aria-label="Your results">
          {results.map((r, i) => <span key={i} className={r ? "sg-y" : "sg-n"}>{r ? "✓" : "✗"}</span>)}
        </div>
        <div className="sg-recap">
          {cards.map((c, i) => (
            <div key={i} className={results[i] ? "sg-y" : "sg-n"}>
              <b aria-label={results[i] ? "Correct" : "Wrong"}>{results[i] ? "✓" : "✗"}</b>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={teamLogo(c.play.team)} alt="" width={22} height={22} className="sg-plate" />
              <span><strong>{c.play.team}</strong> · {c.play.season}</span>
              <span className="sg-c">{c.answer === "fake" ? "Fake" : "Real punt"}</span>
            </div>
          ))}
        </div>
        <pre className="sg-share">{share}</pre>
        <div className="fp-row">
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

  const card = cards[idx];
  const p = card.play;
  const g = guesses[idx];
  const counter = `${idx + 1} of ${n}`;
  const where = `${p.season} ${p.season_type === "POST" ? "playoffs" : `week ${p.week}`} · ${p.team} vs ${p.opp}`;

  if (g === undefined) {
    return (
      <div className="sg-app fp">
        <Header right={counter} />
        <h1 className="fp-h1">Real punt or fake?</h1>
        <section className="fp-card">
          <div className="fp-team">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={teamLogo(p.team)} alt="" width={36} height={36} className="sg-plate" />
            <span>{where}</span>
          </div>
          <p className="sg-sent">{situationText(p)}</p>
          <p className="fp-hint">About 1 in 3 of these is a fake.</p>
        </section>
        <div className="sg-btns">
          <button type="button" className="sg-btn sg-btn-c" onClick={() => setGuesses([...guesses, "real"])}>Real punt</button>
          <button type="button" className="sg-btn sg-btn-c" onClick={() => setGuesses([...guesses, "fake"])}>Fake</button>
        </div>
        <Trademark />
      </div>
    );
  }

  const ok = isCorrect(card, g);
  return (
    <div className={`sg-app sg-rv fp ${ok ? "sg-ok" : "sg-no"}`}>
      <Header right={counter} />
      <h1 className="sg-verdict" aria-live="polite"><span className="sg-glyph" aria-hidden="true">{ok ? "✓" : "✗"}</span>{ok ? "Correct" : "Not this time"}</h1>
      <div className="sg-res">
        <div className="sg-ln"><div className="sg-lbl">You said</div><div className="sg-v">{g === "fake" ? "Fake" : "Real punt"}</div></div>
        <div className="sg-ln"><div className="sg-lbl">It was</div><div className="sg-v">{card.answer === "fake" ? `A fake ${p.kind}${p.first_down ? " · first down" : " · no first down"}` : "A real punt"}</div></div>
        <div className="sg-ln"><div className="sg-lbl">Why</div><div className="sg-v fp-why">{whyText(card)}</div></div>
      </div>
      {card.answer === "fake" ? <p className="fp-desc">{plainDesc(p.desc)}</p> : null}
      <p className="fp-rates">{ratesText(file)}</p>
      <div className="sg-btns">
        <button type="button" className="sg-next" onClick={() => setIdx(idx + 1)}>{idx + 1 < n ? "Next punt" : "See your score"}</button>
      </div>
      <Trademark />
    </div>
  );
}
