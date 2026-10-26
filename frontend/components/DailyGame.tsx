"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { QuizChoice } from "../lib/quiz";
import type { DailyItem } from "../lib/daily";
import {
  dailyStats, dateKey, formatCountdown, formatScore, loadStreak, msUntilNextSet, optionStates,
  practiceSet, rankedValues, recordDaily, saveStreak, scoreCall, shareText, visibleStreak,
  dailySet, setNumber, shareLabel, CLOSE_CALL_GAP, TOO_FAR_NOTE, type CallResult, type ScoredCall, type StreakState,
} from "../lib/daily";
import { CHOICE_NAME, cost, gameText, scoreboardText, whyText } from "../lib/dailyView";
import { playIdFromItemId, storyHref } from "../lib/gameStory";

const PROGRESS_KEY = "fourth-and-daily.progress.v1";
const HOWTO_KEY = "fourth-and-daily.seen-howto.v1";
const RESULT_NAME: Record<CallResult, string> = { right: "Right call", close: "Close call · ½", wrong: "Not the best call" };

type Mode = "daily" | "practice";

/** QA2 M6: say how the score works, including the Close call tolerance (CLOSE_CALL_GAP = 2 pts). */
const SCORING_TEXT = `Score: Right call = 1, Close call = ½, otherwise 0. A Close call is when the top options are within ${Math.round(CLOSE_CALL_GAP * 100)} points of win chance, so it's never counted wrong.`;

function storage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

function Field({ item }: { item: DailyItem }) {
  // 0 = offense's own goal line, 100 = opponent's goal line.
  const ball = 100 - item.situation.yardline_100;
  const first = Math.min(100, ball + item.situation.distance);
  const x = (v: number) => 10 + (v / 100) * 300;
  return (
    <svg className="fd-field" viewBox="0 0 320 44" role="img" aria-label={`Ball ${Math.round(item.situation.yardline_100)} yards from the end zone`}>
      <rect x="0" y="8" width="10" height="28" className="fd-field-ez" />
      <rect x="310" y="8" width="10" height="28" className="fd-field-ez" />
      <rect x="10" y="8" width="300" height="28" className="fd-field-turf" />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={x((i + 1) * 10)} x2={x((i + 1) * 10)} y1="8" y2="36" className="fd-field-line" />
      ))}
      <line x1={x(first)} x2={x(first)} y1="4" y2="40" className="fd-field-first" />
      <circle cx={x(ball)} cy="22" r="6" className="fd-field-ball" />
    </svg>
  );
}

function Bars({ item, scored }: { item: DailyItem; scored: ScoredCall }) {
  const ranked = rankedValues(item);
  return (
    <ul className="fd-bars" aria-label={`${item.situation.posteam} chance to win by choice`}>
      {ranked.map(([id, v]) => (
        <li key={id} className={`fd-bar${id === scored.best ? " is-best" : ""}${id === scored.pick ? " is-pick" : ""}`}>
          <span className="fd-bar-label">
            {CHOICE_NAME[id]}
            {id === scored.pick ? <span className="fd-tag">Your pick</span> : null}
            {id === scored.best ? <span className="fd-tag fd-tag-model">Model&apos;s pick</span> : null}
          </span>
          <span className="fd-bar-track">
            <span className="fd-bar-fill" style={{ width: `${Math.round(v * 100)}%` }} />
          </span>
          <span className="fd-bar-num">
            {item.situation.posteam} {Math.round(v * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

type Picks = (QuizChoice | null)[];

function HowTo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="fd-howto" aria-labelledby="fd-howto-title" onClose={onClose} onCancel={onClose}>
      <h2 id="fd-howto-title">How to play</h2>
      <ol>
        <li><strong>You&apos;re the coach.</strong> Five real 4th downs a day. Pick Go, Kick or Punt, then lock it in.</li>
        <li><strong>Win chance</strong> is the model&apos;s estimate of how often the team with the ball goes on to win after each call. The call with the highest win chance is the right call.</li>
        <li><strong>Close call:</strong> when the top options are within {Math.round(CLOSE_CALL_GAP * 100)} points of win chance, either one gets ½ and is never counted wrong.</li>
      </ol>
      <p className="fd-muted">Right call = 1, Close call = ½, otherwise 0. New set at midnight ET. Everything stays in this browser.</p>
      <form method="dialog"><button type="submit" className="fd-btn fd-btn-primary">Got it</button></form>
    </dialog>
  );
}

export function DailyGame({ mode }: { mode: Mode }) {
  const [today, setToday] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [picks, setPicks] = useState<Picks>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, setPending] = useState<QuizChoice | null>(null);
  const [howto, setHowto] = useState(false);
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Client-only: the day is the viewer's current ET date.
  useEffect(() => {
    const key = dateKey(new Date());
    setToday(key);
    setSeed(Date.now());
    const s = loadStreak(storage());
    setStreak(s);
    try {
      if (!storage()?.getItem(HOWTO_KEY)) setHowto(true);
    } catch {
      /* no storage: don't nag */
    }
    if (mode === "daily") {
      try {
        const raw = storage()?.getItem(PROGRESS_KEY);
        const p = raw ? (JSON.parse(raw) as { date: string; picks: Picks }) : null;
        if (p && p.date === key && Array.isArray(p.picks)) {
          setPicks(p.picks);
          setIndex(p.picks.filter(Boolean).length);
        }
      } catch {
        /* ignore bad saves */
      }
    }
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [mode]);

  // Midnight ET: a new set appears without a reload.
  useEffect(() => {
    if (mode !== "daily" || !today) return;
    if (dateKey(new Date(now)) !== today) {
      setToday(dateKey(new Date(now)));
      setPicks([]);
      setIndex(0);
      setRevealed(false);
    }
  }, [now, today, mode]);

  const items = useMemo(() => {
    if (!today) return [];
    return mode === "daily" ? dailySet(today) : practiceSet(String(seed));
  }, [today, seed, mode]);

  const scores = useMemo(
    () => items.map((it, i) => (picks[i] ? scoreCall(picks[i]!, it) : null)),
    [items, picks],
  );
  const finished = items.length > 0 && scores.every(Boolean);

  useEffect(() => {
    if (mode !== "daily" || !today) return;
    try {
      storage()?.setItem(PROGRESS_KEY, JSON.stringify({ date: today, picks }));
    } catch {
      /* not persisted */
    }
  }, [picks, today, mode]);

  useEffect(() => {
    if (mode !== "daily" || !finished || !today || !streak) return;
    const credit = scores.reduce((a, s) => a + (s?.credit ?? 0), 0);
    const next = recordDaily(streak, { date: today, credit, answered: items.length, results: scores.map((s) => s!.result) });
    if (next !== streak) {
      saveStreak(storage(), next);
      setStreak(next);
    }
  }, [finished, mode, today, streak, scores, items.length]);

  if (!today || !items.length) {
    return (
      <section className="fd-card" aria-busy="true">
        <p className="fd-muted" aria-live="polite">
          Loading today&apos;s 5 — real 4th downs from NFL games. Pick Go, Kick or Punt, then see what the coach did and what
          the numbers say.
        </p>
      </section>
    );
  }

  const shown = visibleStreak(streak ?? { current: 0, best: 0, last_completed: null, history: [] }, today);

  function closeHowto() {
    setHowto(false);
    try {
      storage()?.setItem(HOWTO_KEY, "1");
    } catch {
      /* not persisted */
    }
  }

  function lockIn(c: QuizChoice | null = pending) {
    if (revealed || !c) return;
    const p = [...picks];
    while (p.length < items.length) p.push(null);
    p[index] = c;
    setPicks(p);
    setPending(null);
    setRevealed(true);
  }

  function nextCard() {
    setPending(null);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function playAgain() {
    setSeed((s) => s + 1);
    setPicks([]);
    setIndex(0);
    setRevealed(false);
    setPending(null);
    setCopied(null);
  }

  if (index >= items.length && finished) {
    const done = scores as ScoredCall[];
    const credit = done.reduce((a, s) => a + s.credit, 0);
    const ranked = done.map((s, i) => ({ s, i, c: cost(items[i], s) }));
    const worst = [...ranked].sort((a, b) => b.c - a.c)[0];
    const best = [...ranked].filter((r) => r.s.result === "right").sort((a, b) => b.s.gap - a.s.gap)[0];
    const url = typeof window !== "undefined" ? window.location.origin + window.location.pathname : "";
    const share = shareText(today, done.map((s) => s.result), shown, url);
    const stats = mode === "daily" && streak ? dailyStats(streak, today) : null;
    const maxDays = stats ? Math.max(1, ...stats.score_distribution) : 1;
    return (
      <section className="fd-card fd-end" aria-labelledby="fd-end-title">
        <h2 id="fd-end-title" className="fd-end-title">
          {mode === "daily" ? `Fourth & Daily #${setNumber(today)}` : "Practice set"}
        </h2>
        <p className="fd-end-score" aria-label={`Score ${formatScore(credit)} out of ${items.length}`}>
          {formatScore(credit)}/{items.length}
        </p>
        <p className="fd-muted fd-scoring">{SCORING_TEXT}</p>
        <p className="fd-end-squares" role="img" aria-label={shareLabel(done.map((s) => s.result))}>
          {done.map((s, i) => (
            <span key={i} className={`fd-sq is-${s.result}`} title={RESULT_NAME[s.result]} />
          ))}
        </p>
        {best ? (
          <p>
            <strong>Best call:</strong> {scoreboardText(items[best.i])} — you said {CHOICE_NAME[best.s.pick]}.
          </p>
        ) : null}
        {worst && worst.c > 0 ? (
          <p>
            <strong>Toughest miss:</strong> {scoreboardText(items[worst.i])} — {CHOICE_NAME[worst.s.pick]} cost about{" "}
            {Math.round(worst.c * 100)} points of win chance.
          </p>
        ) : null}
        {mode === "daily" && stats ? (
          <>
            <dl className="fd-stats">
              <div><dt>Streak</dt><dd>{stats.current_streak}</dd></div>
              <div><dt>Best streak</dt><dd>{stats.best_streak}</dd></div>
              <div><dt>Days played</dt><dd>{stats.days_played}</dd></div>
            </dl>
            <ol className="fd-dist" aria-label="Your scores by day">
              {stats.score_distribution.map((n, k) => (
                <li key={k}>
                  <span className="fd-dist-k">{k}</span>
                  <span className="fd-dist-bar" style={{ width: `${Math.max(6, (n / maxDays) * 100)}%` }}>{n}</span>
                </li>
              ))}
            </ol>
            <p className="fd-muted">Next 5 in {formatCountdown(msUntilNextSet(new Date(now)))} (midnight ET).</p>
            <div className="fd-actions">
              <button
                type="button"
                className="fd-btn fd-btn-primary fd-share"
                onClick={async () => {
                  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
                  if (nav.share) {
                    try {
                      await nav.share({ text: share });
                      return;
                    } catch (e) {
                      if ((e as DOMException)?.name === "AbortError") return;
                    }
                  }
                  try {
                    await navigator.clipboard.writeText(share);
                    setCopied("Copied. Paste it anywhere.");
                  } catch {
                    setCopied(share);
                  }
                }}
              >
                Share
              </button>
            </div>
            {copied ? <p className="fd-muted fd-copied" aria-live="polite">{copied}</p> : null}
          </>
        ) : (
          <div className="fd-actions">
            <button type="button" className="fd-btn fd-btn-primary" onClick={playAgain}>
              Play again
            </button>
          </div>
        )}
      </section>
    );
  }

  const item = items[index];
  const scored = scores[index];
  const opts = optionStates(item);
  const choices = opts.filter((o) => o.shown);
  const enabled = choices.filter((o) => !o.disabled);
  const focusId = pending ?? enabled[0]?.id;

  function onChoiceKey(e: KeyboardEvent<HTMLButtonElement>, id: QuizChoice) {
    const k = e.key;
    if (k === "Enter") {
      e.preventDefault();
      lockIn(pending ?? id);
      return;
    }
    if (k === " ") {
      e.preventDefault();
      setPending(id);
      return;
    }
    const step = k === "ArrowRight" || k === "ArrowDown" ? 1 : k === "ArrowLeft" || k === "ArrowUp" ? -1 : 0;
    if (!step || !enabled.length) return;
    e.preventDefault();
    const at = Math.max(0, enabled.findIndex((o) => o.id === id));
    const next = enabled[(at + step + enabled.length) % enabled.length].id;
    setPending(next);
    choiceRefs.current[choices.findIndex((o) => o.id === next)]?.focus();
  }

  return (
    <section className="fd-card" aria-label={`Call ${index + 1} of ${items.length}`}>
      <HowTo open={howto} onClose={closeHowto} />
      <div className="fd-card-top">
        <span className="fd-count">Call {index + 1} of {items.length}</span>
        <span className="fd-top-right">
          {mode === "daily" ? (
            <span className="fd-count" aria-label={`Current streak ${shown} ${shown === 1 ? "day" : "days"}`}>
              Streak: {shown} {shown === 1 ? "day" : "days"}
            </span>
          ) : (
            <span className="fd-count">Practice</span>
          )}
          <button type="button" className="fd-help" aria-label="How to play" onClick={() => setHowto(true)}>?</button>
        </span>
      </div>
      <div className="fd-progress" role="progressbar" aria-label="Calls done" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={scores.filter(Boolean).length}>
        {items.map((_, i) => <span key={i} className={scores[i] ? "is-done" : i === index ? "is-now" : undefined} />)}
      </div>
      <p className="fd-scoreboard">{scoreboardText(item)}</p>
      <Field item={item} />
      <p className="fd-game">{gameText(item)}</p>

      {!revealed || !scored ? (
        <div className="fd-pick">
          {index === 0 ? <p className="fd-hint" id="fd-hint">Pick a call, then lock it in. Arrow keys move, Enter locks it in.</p> : null}
          {opts.find((o) => o.id === "fg" && !o.shown) ? <p className="fd-toofar">{TOO_FAR_NOTE}</p> : null}
          <div className="fd-choices" role="radiogroup" aria-label="Your call" aria-describedby={index === 0 ? "fd-hint" : undefined}>
            {choices.map((o, i) => (
              <button
                key={o.id}
                ref={(el) => { choiceRefs.current[i] = el; }}
                type="button"
                role="radio"
                aria-checked={pending === o.id}
                tabIndex={o.id === focusId ? 0 : -1}
                className={`fd-choice${pending === o.id ? " is-picked" : ""}`}
                disabled={o.disabled}
                onClick={() => setPending(o.id)}
                onKeyDown={(e) => onChoiceKey(e, o.id)}
              >
                <span>{CHOICE_NAME[o.id]}</span>
                {o.id === "fg" && o.note ? <small>{o.note}</small> : null}
              </button>
            ))}
          </div>
          <button type="button" className="fd-btn fd-btn-primary fd-lock" disabled={!pending} onClick={() => lockIn()}>
            {pending ? `Lock in ${CHOICE_NAME[pending]}` : "Pick a call"}
          </button>
          <p className="fd-muted fd-scoring">{SCORING_TEXT}</p>
        </div>
      ) : (
        <div className="fd-reveal" aria-live="polite">
          <p className={`fd-result is-${scored.result}`}>{RESULT_NAME[scored.result]}</p>
          <p className="fd-line">
            You: {CHOICE_NAME[scored.pick]} · Coach: {item.historical_action ? CHOICE_NAME[item.historical_action as QuizChoice] ?? item.historical_action : "—"} · Model:{" "}
            {CHOICE_NAME[scored.best]}
          </p>
          <Bars item={item} scored={scored} />
          <p className="fd-why">
            <strong>Why:</strong> {whyText(item, scored)}
          </p>
          <p className="fd-links">
            {storyHref(item.source.game_id, playIdFromItemId(item.id)) ? (
              <Link href={storyHref(item.source.game_id, playIdFromItemId(item.id))!}>See this game at this play</Link>
            ) : null}
            <Link href={`/fourth-down/?play=${encodeURIComponent(item.id)}`}>Open in the 4th-down checker</Link>
            <Link href={`/card/${encodeURIComponent(item.id)}/`}>Share as a what-if card</Link>
          </p>
          <div className="fd-actions">
            <button type="button" className="fd-btn fd-btn-primary" onClick={nextCard}>
              {index + 1 >= items.length ? "See results" : "Next call"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
