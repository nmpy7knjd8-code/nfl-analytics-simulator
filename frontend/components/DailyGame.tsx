"use client";

import { useEffect, useMemo, useState } from "react";
import type { QuizChoice } from "../lib/quiz";
import type { DailyItem } from "../lib/daily";
import {
  dailyStats, dateKey, formatCountdown, formatScore, loadStreak, msUntilNextSet, optionStates,
  practiceSet, rankedValues, recordDaily, saveStreak, scoreCall, shareText, visibleStreak,
  dailySet, type CallResult, type ScoredCall, type StreakState,
  closeNote, formatPercents, CLOSE_CALL_GAP,
} from "../lib/daily";
import { revealRow } from "../lib/revealRow";
import { CHOICE_NAME, cost, gameText, scoreboardText, whyText } from "../lib/dailyView";

const PROGRESS_KEY = "fourth-and-daily.progress.v1";
const RESULT_NAME: Record<CallResult, string> = { right: "Right call", close: "Close call · ½", wrong: "Not the best call" };

type Mode = "daily" | "practice";

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
  const pcts = formatPercents(ranked.map(([, v]) => v));
  const bestV = scored.values[scored.best] ?? 0;
  const offered = new Set(optionStates(item).filter((o) => o.shown && !o.disabled).map((o) => o.id));
  const RESULT = { right: "correct", close: "near_tie", wrong: "incorrect" } as const;
  // #98 / 2236 P1-E, P2-H: shared row state; a Correct pick is never the miss style.
  const row = (id: QuizChoice) =>
    revealRow(id, {
      inconclusive: scored.closeCall,
      result: RESULT[scored.result],
      recommendation: scored.best,
      selected: scored.pick,
      nearTie: ranked.filter(([c, v]) => offered.has(c) && bestV - v < CLOSE_CALL_GAP).map(([c]) => c),
      off: !offered.has(id),
    });
  // M13: only the top value is ever tagged Best.
  const tagFor = (id: QuizChoice) => {
    const t = row(id).tag;
    if (t === "Your pick") return t;
    if (id === scored.best) return "Best";
    return t === "Best" ? "About as good" : t;
  };
  return (
    <ul className="fd-bars" aria-label={`${item.situation.posteam} chance to win by choice`}>
      {ranked.map(([id, v]) => (
        <li key={id} className={`fd-bar res-${scored.result}${id === scored.best ? " is-best" : ""}${id === scored.pick ? " is-pick" : ""}${row(id).rec ? " is-rec" : ""}${row(id).close ? " is-close" : ""}`}>
          <span className="fd-bar-label">
            <span className="fd-bar-name">{CHOICE_NAME[id]}</span>
            {tagFor(id) ? <span className="quiz-tag fd-tag">{tagFor(id)}</span> : null}
          </span>
          <span className="fd-bar-track">
            <span className="fd-bar-fill" style={{ width: `${Math.round(v * 100)}%` }} />
          </span>
          <span className="fd-bar-num">
            {item.situation.posteam} {pcts[ranked.findIndex(([c]) => c === id)]}
          </span>
        </li>
      ))}
    </ul>
  );
}

type Picks = (QuizChoice | null)[];

export function DailyGame({ mode }: { mode: Mode }) {
  const [today, setToday] = useState<string | null>(null);
  const [seed, setSeed] = useState(0);
  const [picks, setPicks] = useState<Picks>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState<string | null>(null);

  // Client-only: the day is the viewer's current ET date.
  useEffect(() => {
    const key = dateKey(new Date());
    setToday(key);
    setSeed(Date.now());
    const s = loadStreak(storage());
    setStreak(s);
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

  function choose(c: QuizChoice) {
    if (revealed) return;
    const p = [...picks];
    while (p.length < items.length) p.push(null);
    p[index] = c;
    setPicks(p);
    setRevealed(true);
  }

  function nextCard() {
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  function playAgain() {
    setSeed((s) => s + 1);
    setPicks([]);
    setIndex(0);
    setRevealed(false);
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
        <h2 id="fd-end-title" className="fd-end-score">
          {formatScore(credit)}/{items.length}
        </h2>
        <p className="fd-end-squares" aria-label="Your calls">
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
                className="fd-btn fd-btn-primary"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(share);
                    setCopied("Copied — paste it anywhere.");
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
  return (
    <section className="fd-card" aria-label={`Call ${index + 1} of ${items.length}`}>
      <div className="fd-card-top">
        <span className="fd-count">
          {index + 1}/{items.length}
        </span>
        {mode === "daily" ? <span className="fd-count">Streak {shown}</span> : <span className="fd-count">Practice</span>}
      </div>
      <p className="fd-scoreboard">{scoreboardText(item)}</p>
      <Field item={item} />
      <p className="fd-game">{gameText(item)}</p>

      {!revealed || !scored ? (
        <div className="fd-choices" role="group" aria-label="Your call">
          {opts
            .filter((o) => o.shown)
            .map((o) => (
              <button key={o.id} type="button" className="fd-choice" disabled={o.disabled} onClick={() => choose(o.id)}>
                <span>{CHOICE_NAME[o.id]}</span>
                {o.id === "fg" && o.note ? <small>{o.note}</small> : null}
              </button>
            ))}
        </div>
      ) : (
        <div className="fd-reveal" aria-live="polite">
          <p className={`fd-result is-${scored.result}`}>{RESULT_NAME[scored.result]}</p>
          {closeNote(scored) ? <p className="fd-close-note">{closeNote(scored)}</p> : null}
          <p className="fd-line">
            You: {CHOICE_NAME[scored.pick]} · Coach: {item.historical_action ? CHOICE_NAME[item.historical_action as QuizChoice] ?? item.historical_action : "—"} · Model:{" "}
            {CHOICE_NAME[scored.best]}
          </p>
          <Bars item={item} scored={scored} />
          <p className="fd-why">
            <strong>Why:</strong> {whyText(item, scored)}
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
