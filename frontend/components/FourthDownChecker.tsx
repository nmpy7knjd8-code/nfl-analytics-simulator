"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuizChoice } from "../lib/quiz";
import { DAILY_ITEMS } from "../lib/daily";
import {
  checkSituation, clock, fieldText, marginText, MAX_DISTANCE, MIN_DISTANCE, situationFromItem, whatCouldChange,
  type CheckSituation, type FourthDownGrid,
} from "../lib/checker";
import { gameText } from "../lib/dailyView";
import { playIdFromItemId, storyHref } from "../lib/gameStory";

const NAME: Record<QuizChoice, string> = { go: "Go for it", fg: "Kick the field goal", punt: "Punt" };
const SHORT: Record<QuizChoice, string> = { go: "Go", fg: "Kick", punt: "Punt" };
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const START: CheckSituation = {
  distance: 2, yardline_100: 45, posteam_score: 17, defteam_score: 20, qtr: 4,
  quarter_seconds_remaining: 300, posteam_timeouts: 3, defteam_timeouts: 3,
};

function Stepper({ label, value, onDown, onUp, downOff, upOff }: {
  label: string; value: string; onDown: () => void; onUp: () => void; downOff?: boolean; upOff?: boolean;
}) {
  return (
    <div className="ck-step" role="group" aria-label={label}>
      <span className="ck-step-label">{label}</span>
      <button type="button" className="ck-step-btn" onClick={onDown} disabled={downOff} aria-label={`${label}: less`}>−</button>
      <output className="ck-step-val" aria-live="polite">{value}</output>
      <button type="button" className="ck-step-btn" onClick={onUp} disabled={upOff} aria-label={`${label}: more`}>+</button>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function FourthDownChecker() {
  const [sit, setSit] = useState<CheckSituation>(START);
  const [grid, setGrid] = useState<FourthDownGrid | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // ?play=<daily item id> opens the checker on that exact real play.
    const id = new URLSearchParams(window.location.search).get("play");
    const item = id ? DAILY_ITEMS.find((it) => it.id === id) : null;
    if (item) setSit(situationFromItem(item));
    fetch(`${BASE}/data/fourth_down/grid.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: FourthDownGrid) => setGrid(g))
      .catch(() => setFailed(true));
  }, []);

  const set = (patch: Partial<CheckSituation>) => setSit((s) => ({ ...s, ...patch }));
  const result = useMemo(() => checkSituation(sit, grid), [sit, grid]);
  const changes = useMemo(() => (result ? whatCouldChange(sit, grid, result.best) : []), [sit, grid, result]);
  const loading = !grid && !failed && result?.source.kind !== "play";

  const fgOpt = result?.options.find((o) => o.id === "fg");
  const fgOff = fgOpt?.disabled && fgOpt.note ? fgOpt.note.replace(/^Too far: /, "a ").replace("-yd kick", "-yd try") : null;
  const real = result?.source.kind === "play" ? result.source.item : null;
  const realHref = real ? storyHref(real.source.game_id, playIdFromItemId(real.id)) : null;

  return (
    <div className="ck">
      <section className="fd-card" aria-labelledby="ck-in">
        <h2 id="ck-in" className="gs-h2">The situation</h2>
        <p className="ck-summary">
          4th &amp; {sit.distance} at {fieldText(sit.yardline_100)} · {marginText(sit.posteam_score - sit.defteam_score)} ({sit.posteam_score}–{sit.defteam_score}) · Q{sit.qtr} {clock(sit.quarter_seconds_remaining)}
        </p>
        <div className="ck-steps">
          <div className="ck-step"><span className="ck-step-label">Down</span><span className="ck-step-val ck-fixed">4th</span></div>
          <Stepper label="Yards to go" value={String(sit.distance)}
            onDown={() => set({ distance: clamp(sit.distance - 1, MIN_DISTANCE, MAX_DISTANCE) })}
            onUp={() => set({ distance: clamp(sit.distance + 1, MIN_DISTANCE, MAX_DISTANCE) })}
            downOff={sit.distance <= MIN_DISTANCE} upOff={sit.distance >= MAX_DISTANCE} />
          <Stepper label="Ball on" value={fieldText(sit.yardline_100)}
            onDown={() => set({ yardline_100: clamp(sit.yardline_100 + 1, 1, 99) })}
            onUp={() => set({ yardline_100: clamp(sit.yardline_100 - 1, 1, 99) })}
            downOff={sit.yardline_100 >= 99} upOff={sit.yardline_100 <= 1} />
          <Stepper label="Your score" value={String(sit.posteam_score)}
            onDown={() => set({ posteam_score: Math.max(0, sit.posteam_score - 1) })}
            onUp={() => set({ posteam_score: sit.posteam_score + 1 })} downOff={sit.posteam_score <= 0} />
          <Stepper label="Their score" value={String(sit.defteam_score)}
            onDown={() => set({ defteam_score: Math.max(0, sit.defteam_score - 1) })}
            onUp={() => set({ defteam_score: sit.defteam_score + 1 })} downOff={sit.defteam_score <= 0} />
          <Stepper label="Quarter" value={`Q${sit.qtr}`}
            onDown={() => set({ qtr: clamp(sit.qtr - 1, 1, 4) })} onUp={() => set({ qtr: clamp(sit.qtr + 1, 1, 4) })}
            downOff={sit.qtr <= 1} upOff={sit.qtr >= 4} />
          <Stepper label="Clock" value={clock(sit.quarter_seconds_remaining)}
            onDown={() => set({ quarter_seconds_remaining: clamp(sit.quarter_seconds_remaining - 15, 0, 900) })}
            onUp={() => set({ quarter_seconds_remaining: clamp(sit.quarter_seconds_remaining + 15, 0, 900) })}
            downOff={sit.quarter_seconds_remaining <= 0} upOff={sit.quarter_seconds_remaining >= 900} />
          <Stepper label="Your timeouts" value={String(sit.posteam_timeouts)}
            onDown={() => set({ posteam_timeouts: clamp(sit.posteam_timeouts - 1, 0, 3) })}
            onUp={() => set({ posteam_timeouts: clamp(sit.posteam_timeouts + 1, 0, 3) })}
            downOff={sit.posteam_timeouts <= 0} upOff={sit.posteam_timeouts >= 3} />
          <Stepper label="Their timeouts" value={String(sit.defteam_timeouts)}
            onDown={() => set({ defteam_timeouts: clamp(sit.defteam_timeouts - 1, 0, 3) })}
            onUp={() => set({ defteam_timeouts: clamp(sit.defteam_timeouts + 1, 0, 3) })}
            downOff={sit.defteam_timeouts <= 0} upOff={sit.defteam_timeouts >= 3} />
        </div>
      </section>

      <section className="fd-card" aria-labelledby="ck-out" aria-live="polite">
        <h2 id="ck-out" className="gs-h2">The call</h2>
        {loading ? <p className="fd-muted">Loading the engine grid…</p> : null}
        {failed && !result ? <p className="fd-muted">Couldn&apos;t load the engine grid. Try again in a moment.</p> : null}
        {!loading && !result && !failed ? <p className="fd-muted">No engine value for this spot.</p> : null}
        {result ? (
          <>
            <p className="ck-rec">{NAME[result.best]}</p>
            {result.closeCall ? <p className="ck-close">Close call: the top two are under 2 pts apart.</p> : null}
            <ul className="fd-bars" aria-label="Chance to win by choice">
              {result.options.filter((o) => o.shown).map((o) => {
                const v = result.item.reveal.values[o.id];
                const off = o.disabled || v == null;
                return (
                  <li key={o.id} className={`fd-bar${o.id === result.best ? " is-best" : ""}`}>
                    <span className="fd-bar-label">{SHORT[o.id]}</span>
                    <span className="fd-bar-track">
                      <span className="fd-bar-fill" style={{ width: off ? 0 : `${Math.round(v! * 100)}%` }} />
                    </span>
                    <span className="fd-bar-num">{off ? (o.id === "fg" ? "Too far" : "—") : `${(v! * 100).toFixed(1)}%`}</span>
                  </li>
                );
              })}
            </ul>
            {result.ranked.length > 1 ? (
              <p className="fd-why">
                <strong>Why:</strong> {NAME[result.best]} gives the offense a {(result.ranked[0][1] * 100).toFixed(1)}% chance to win, {(result.gap * 100).toFixed(1)} pts more than {SHORT[result.ranked[1][0]]}.
                {fgOff ? ` Kick is off: ${fgOff}, past the 64-yd limit.` : ""}
              </p>
            ) : null}
            <div>
              <h3 className="ck-h3">What could change this</h3>
              {changes.length ? (
                <ul className="ck-changes">{changes.map((c) => <li key={c}>{c}</li>)}</ul>
              ) : (
                <p className="fd-muted">{grid ? "Nothing nearby flips it: 1 yard more or less to go, 5 yards either way, or 3 points either way." : "Loading…"}</p>
              )}
            </div>
            <p className="fd-muted ck-src">
              {result.source.kind === "play" && real ? (
                <>
                  Same numbers as the Daily: this is a real play, {gameText(real)}.{" "}
                  {realHref ? <a href={`${BASE}${realHref}`}>See this game at this play</a> : null}
                </>
              ) : result.source.kind === "grid" ? (
                <>
                  From the engine grid (same engine as the Daily). {result.source.assumptions.length ? `Nearest grid point: ${result.source.assumptions.join("; ")}.` : ""} The grid assumes the offense is the home team.
                </>
              ) : null}
            </p>
          </>
        ) : null}
      </section>
    </div>
  );
}
