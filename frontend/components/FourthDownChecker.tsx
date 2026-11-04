"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuizChoice } from "../lib/quiz";
import { DAILY_ITEMS } from "../lib/daily";
import {
  checkSituation, clock, fieldText, marginText, MAX_DISTANCE, MIN_DISTANCE, situationFromItem, whatCouldChange,
  type CheckSituation, type FourthDownGrid,
} from "../lib/checker";
import { gameText } from "../lib/dailyView";
import { Header, Trademark } from "./SimpleGame";

const NAME: Record<QuizChoice, string> = { go: "Go for it", fg: "Kick the field goal", punt: "Punt" };
const SHORT: Record<QuizChoice, string> = { go: "Go", fg: "Kick", punt: "Punt" };
/** Daily item ids are "{game_id}-{play_id}". */
function storyHref(gameId: string | undefined | null, id: string): string | null {
  const m = /-(\d+)$/.exec(id);
  return gameId && m ? `/games/${gameId}/#play-${m[1]}` : null;
}

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const START: CheckSituation = {
  distance: 2, yardline_100: 45, posteam_score: 17, defteam_score: 20, qtr: 4,
  quarter_seconds_remaining: 300, posteam_timeouts: 3, defteam_timeouts: 3,
};

function Stepper({ label, value, onDown, onUp, downOff, upOff }: {
  label: string; value: string; onDown: () => void; onUp: () => void; downOff?: boolean; upOff?: boolean;
}) {
  return (
    <div className="fd4-step" role="group" aria-label={label}>
      <span className="fd4-step-l">{label}</span>
      <button type="button" className="fd4-sb" onClick={onDown} disabled={downOff} aria-label={`${label}: less`}>−</button>
      <output className="fd4-sv" aria-live="polite">{value}</output>
      <button type="button" className="fd4-sb" onClick={onUp} disabled={upOff} aria-label={`${label}: more`}>+</button>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function FourthDownChecker() {
  const [sit, setSit] = useState<CheckSituation>(START);
  const [grid, setGrid] = useState<FourthDownGrid | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setFailed(false);
    // ?play=<daily item id> opens the checker on that exact real play.
    const id = new URLSearchParams(window.location.search).get("play");
    const item = id ? DAILY_ITEMS.find((it) => it.id === id) : null;
    if (item) setSit(situationFromItem(item));
    fetch(`${BASE}/data/fourth_down/grid.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((g: FourthDownGrid) => setGrid(g))
      .catch(() => setFailed(true));
  }, [attempt]);

  const set = (patch: Partial<CheckSituation>) => setSit((s) => ({ ...s, ...patch }));
  const result = useMemo(() => {
    try { return checkSituation(sit, grid); } catch { return null; }
  }, [sit, grid]);
  const changes = useMemo(() => {
    try { return result ? whatCouldChange(sit, grid, result.best) : []; } catch { return []; }
  }, [sit, grid, result]);
  const loading = !grid && !failed && result?.source.kind !== "play";

  const fgOpt = result?.options.find((o) => o.id === "fg");
  const fgOff = fgOpt?.disabled && fgOpt.note ? fgOpt.note.replace(/^Too far: /, "a ").replace("-yd kick", "-yd try") : null;
  const real = result?.source.kind === "play" ? result.source.item : null;
  const realHref = real ? storyHref(real.source.game_id, real.id) : null;

  const status = (body: React.ReactNode, alert = false) => (
    <div className="sg-app fd4">
      <Header right="4th down" />
      <div className="sg-status" role={alert ? "alert" : "status"}>{body}</div>
      <Trademark />
    </div>
  );
  if (loading) return status(<><span className="sg-spin" aria-hidden="true" /><p>Loading…</p></>);
  if (failed && !result) return status(<><p>Couldn&apos;t load the numbers.</p><button type="button" className="sg-next fd4-cta" onClick={() => setAttempt((a) => a + 1)}>Try again</button></>, true);

  return (
    <div className="sg-app fd4">
      <Header right="4th down" />
      <h1 className="fd4-h1">Go, kick, or punt?</h1>
      <section className="fd4-card" aria-label="The situation">
        <p className="fd4-sum">
          4th &amp; {sit.distance} at {fieldText(sit.yardline_100)} · {marginText(sit.posteam_score - sit.defteam_score)} · Q{sit.qtr} {clock(sit.quarter_seconds_remaining)}
        </p>
        <div className="fd4-steps">
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

      <section className="fd4-card fd4-out" aria-label="The call" aria-live="polite">
        {!result ? <p className="fd4-muted">No numbers for this spot yet. Try a different spot.</p> : (
          <>
            <p className="fd4-rec"><span className="sg-lbl">The call</span> {NAME[result.best]}{result.closeCall ? <span className="fd4-close">Close call</span> : null}</p>
            <ul className="fd4-bars" aria-label="Chance to win by choice">
              {result.options.filter((o) => o.shown).map((o) => {
                const v = result.item.reveal.values[o.id];
                const off = o.disabled || v == null;
                return (
                  <li key={o.id} className={o.id === result.best ? "is-best" : undefined}>
                    <span className="fd4-bl">{SHORT[o.id]}</span>
                    <span className="fd4-track"><span style={{ width: off ? 0 : `${Math.round(v! * 100)}%` }} /></span>
                    <span className="fd4-num">{off ? (o.id === "fg" ? "Too far" : "—") : `${(v! * 100).toFixed(1)}%`}</span>
                  </li>
                );
              })}
            </ul>
            {result.ranked.length > 1 ? (
              <p className="fd4-why">
                {(result.ranked[0][1] * 100).toFixed(1)}% chance to win, {(result.gap * 100).toFixed(1)} points better than {SHORT[result.ranked[1][0]].toLowerCase()}.
                {fgOff ? ` No kick: ${fgOff} is too long.` : ""}
                {changes.length ? ` ${changes[0]}` : ""}
              </p>
            ) : null}
            {real ? (
              <p className="fd4-muted">Real play: {gameText(real)}.{" "}{realHref ? <a href={`${BASE}${realHref}`}>See the game</a> : null}</p>
            ) : null}
          </>
        )}
      </section>
      <Trademark />
    </div>
  );
}
