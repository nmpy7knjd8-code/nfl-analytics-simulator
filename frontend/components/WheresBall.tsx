"use client";

import { useMemo, useState } from "react";
import { roundsFor, roundScore, clampSpot, ROUNDS_PER_GAME, type BallRound } from "../lib/wheresBall";
import { goRates, cellAt, pct, spotLabel } from "../lib/goRates";
import { Header, Trademark } from "./SimpleGame";

const today = () => new Date().toISOString().slice(0, 10);
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const ord = ["", "1st", "2nd", "3rd", "4th"];

/** Field drawn left = offense's own goal line, right = opponent's goal line. x% = 100 - yardline_100. */
function Field({ guess, actual, onMove, r }: { guess: number; actual: number | null; onMove: (y: number) => void; r: BallRound }) {
  const fromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onMove(clampSpot(100 - ((e.clientX - box.left) / box.width) * 100));
  };
  return (
    <div className="wb-wrap">
      <div className="wb-ends"><span>{r.posteam} goal</span><span>{r.defteam} goal →</span></div>
      <div
        className="wb-field" role="slider" tabIndex={actual === null ? 0 : -1}
        aria-label="Ball spot" aria-valuemin={1} aria-valuemax={99} aria-valuenow={100 - guess} aria-valuetext={spotLabel(guess)}
        onPointerDown={(e) => { if (actual !== null) return; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => { if (actual === null && e.buttons) fromPointer(e); }}
        onKeyDown={(e) => {
          if (actual !== null) return;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); onMove(clampSpot(guess - 1)); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); onMove(clampSpot(guess + 1)); }
        }}
      >
        {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((x) => (
          <div key={x} className="wb-yl" style={{ left: `${x}%` }}><span>{x <= 50 ? x : 100 - x}</span></div>
        ))}
        {actual !== null ? <div className="wb-gap" style={{ left: `${100 - Math.max(guess, actual)}%`, width: `${Math.abs(guess - actual)}%` }} /> : null}
        <div className="wb-ball is-guess" style={{ left: `${100 - guess}%` }} aria-hidden="true" />
        {actual !== null ? <div className="wb-ball is-real" style={{ left: `${100 - actual}%` }} aria-hidden="true" /> : null}
      </div>
    </div>
  );
}

export function WheresBall() {
  const rounds = useMemo(() => roundsFor(today()), []);
  const [i, setI] = useState(0);
  const [guess, setGuess] = useState(50);
  const [shown, setShown] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const r = rounds[i];
  const done = scores.length === ROUNDS_PER_GAME && !shown;

  const lock = () => { setShown(true); setScores((s) => [...s, roundScore(guess, r.yardline100)]); };
  const next = () => { setShown(false); setGuess(50); setI((n) => n + 1); };

  const goCell = r ? cellAt(goRates, r.distance, r.yardline100) : null;
  const total = scores.reduce((a, b) => a + b, 0);

  return (
    <div className="sg-app kb">
      <Header right="Where's the ball?" />
      <h1 className="kb-h1">Where&apos;s the ball?</h1>
      {done ? (
        <section className="kb-hero ch-pick">
          <div className="mc-total">{total} of {ROUNDS_PER_GAME * 100}</div>
          <ul className="era-rows">{scores.map((s, n) => <li key={n}>Round {n + 1}<strong>{s}</strong></li>)}</ul>
          <p className="kb-note">New spots tomorrow.</p>
        </section>
      ) : (
        <>
          <p className="kb-lede">A real 4th down. Drag the ball to where you think it was snapped, then lock it in.</p>
          <section className="kb-hero ch-pick">
            <div className="era-pick-h">Round {i + 1} of {ROUNDS_PER_GAME}</div>
            <div className="wb-sit">
              <strong>{r.posteam}</strong> {r.posScore}, <strong>{r.defteam}</strong> {r.defScore}
              <div className="mc-sub">{ord[r.qtr]} quarter, {clock(r.secs)} left · 4th-and-{r.distance}</div>
            </div>
            <Field guess={guess} actual={shown ? r.yardline100 : null} onMove={setGuess} r={r} />
            <div className="wb-step">
              <button type="button" className="mc-chip" aria-label="Back 1 yard" disabled={shown} onClick={() => setGuess((g) => clampSpot(g + 1))}>−1</button>
              <span className="wb-spot">{spotLabel(guess)}</span>
              <button type="button" className="mc-chip" aria-label="Forward 1 yard" disabled={shown} onClick={() => setGuess((g) => clampSpot(g - 1))}>+1</button>
            </div>
          </section>

          {shown ? (
            <section className="kb-hero ch-pick" aria-live="polite">
              <ul className="era-rows">
                <li>Real spot<strong>{spotLabel(r.yardline100)}</strong></li>
                <li>You were off by<strong>{Math.abs(guess - r.yardline100)} yd</strong></li>
                <li className="era-all">Points<strong>{scores[scores.length - 1]}</strong></li>
              </ul>
              {goCell && goCell.cell[0] >= goRates.minPlays ? (
                <p className="kb-note">Coaches go for it here {pct(goCell.cell[1], goCell.cell[0])}% of the time ({goCell.cell[0].toLocaleString()} real plays).</p>
              ) : null}
              <button type="button" className="sg-btn" onClick={next}>{i + 1 < ROUNDS_PER_GAME ? "Next spot" : "See score"}</button>
            </section>
          ) : (
            <button type="button" className="sg-btn" onClick={lock}>Lock it in</button>
          )}
        </>
      )}
      <p className="kb-note">Real plays from the first four quarters. Go-for-it rates: nflverse play-by-play, {goRates.seasons[0]}–{goRates.seasons[1]}.</p>
      <Trademark />
    </div>
  );
}
