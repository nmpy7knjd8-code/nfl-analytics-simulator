"use client";

import { useEffect, useState } from "react";
import { dateKey } from "../lib/daily";
import {
  FD_RESULTS_KEY, firstDownShare, pct, situationText, spotLabel, spotRates, weekKey, weekNumber, weeklySet,
  type FirstDownCall, type FirstDownPlay,
} from "../lib/firstDown";
import { CardSkeleton } from "./EmptyState";

const NAME: Record<FirstDownCall, string> = { pass: "Pass", run: "Run" };

/** Bonus round. Saved per week; never touches the daily streak. */
export function FirstDownGame() {
  const [monday, setMonday] = useState("");
  const [plays, setPlays] = useState<FirstDownPlay[]>([]);
  const [picks, setPicks] = useState<FirstDownCall[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const m = weekKey(dateKey());
    setMonday(m);
    setPlays(weeklySet(m));
    try {
      const saved = JSON.parse(localStorage.getItem(FD_RESULTS_KEY) ?? "{}");
      if (saved.week === m && Array.isArray(saved.picks)) {
        setPicks(saved.picks);
        setRevealed(saved.picks.length > 0);
      }
    } catch { /* fresh start */ }
  }, []);

  if (!monday || !plays.length) return <CardSkeleton label="Loading this week's 1st downs" />;

  const index = revealed ? picks.length - 1 : picks.length;
  const pick = (c: FirstDownCall) => {
    const next = [...picks, c];
    setPicks(next);
    setRevealed(true);
    try { localStorage.setItem(FD_RESULTS_KEY, JSON.stringify({ week: monday, picks: next })); } catch { /* private mode */ }
  };

  const done = picks.length === plays.length;
  const right = picks.map((p, i) => p === plays[i].call);

  const play = plays[Math.min(index, plays.length - 1)];
  const mine = picks[index];
  const rates = spotRates(play);

  return (
    <>
      <section className="fd-card" aria-labelledby="fdn-h">
        <div className="fd-card-top">
          <span className="fd-count">Play {Math.min(index, plays.length - 1) + 1} of {plays.length}</span>
          <span className="fd-count">Week {weekNumber(monday)}</span>
        </div>
        <h2 id="fdn-h" className="fd-spot">{situationText(play)}</h2>
        <p className="fd-game fd-muted">{play.away_team} @ {play.home_team} · {play.season} Week {play.week}</p>
        {!revealed ? (
          <div className="fd-options fdn-options" role="group" aria-label="Your call">
            {(["pass", "run"] as const).map((c) => (
              <button key={c} type="button" className="fd-btn fd-opt fdn-opt" onClick={() => pick(c)}>{NAME[c]}</button>
            ))}
          </div>
        ) : (
          <div className="fd-reveal" aria-live="polite">
            <p className="fd-verdict">
              {mine === play.call ? "Match." : "Not this time."} The coach called a <strong>{play.call}</strong>: {play.result}.
              {" "}{play.on_schedule ? "It kept them on schedule." : "It left them behind the chains."}
            </p>
            <p>
              {rates.similar ? `On 1st & 10 ${spotLabel(play)}` : "On 1st & 10 across the league"} (2019-25), passes stayed on
              schedule {pct(rates.pass.on_schedule)} of the time ({rates.pass.plays.toLocaleString()} plays) and runs {pct(rates.run.on_schedule)} ({rates.run.plays.toLocaleString()} plays).
            </p>
            <p className="fd-muted">On schedule = nflverse rates the play a success: it left them in a better spot to score than before the snap. Your score is matching the real call.</p>
            <details><summary>Play-by-play</summary><p className="fd-muted">{play.desc}</p></details>
            {!done ? (
              <button type="button" className="fd-btn fd-btn-primary fd-empty-btn" onClick={() => setRevealed(false)}>Next play</button>
            ) : null}
          </div>
        )}
      </section>
      {done ? (
        <section className="fd-card fd-end" aria-labelledby="fdn-end">
          <h2 id="fdn-end">First-down call, week {weekNumber(monday)}</h2>
          <p className="fd-end-score">{right.filter(Boolean).length}/{plays.length}</p>
          <p className="fd-muted">You matched the real call on {right.filter(Boolean).length} of {plays.length}. Bonus round: doesn&apos;t count for your streak. New plays every Monday.</p>
          <button type="button" className="fd-btn fd-btn-primary fd-share" onClick={async () => {
            const text = firstDownShare(monday, right, location.href);
            const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
            if (nav.share) { try { await nav.share({ text }); return; } catch (e) { if ((e as DOMException)?.name === "AbortError") return; } }
            try { await navigator.clipboard.writeText(text); setCopied("Copied. Paste it anywhere."); } catch { setCopied(text); }
          }}>Share</button>
          {copied ? <p className="fd-muted" aria-live="polite">{copied}</p> : null}
        </section>
      ) : null}
    </>
  );
}
