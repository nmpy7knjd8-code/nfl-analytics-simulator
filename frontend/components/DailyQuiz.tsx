"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { QuizGame } from "./QuizGame";
import {
  DAILY_SET_SIZE,
  dailySet,
  dailyStats,
  dateKey,
  emptyStreak,
  formatCountdown,
  getOrCreateHandle,
  loadStreak,
  msUntilNextSet,
  recordDaily,
  saveStreak,
  shareText,
  visibleStreak,
  type StreakState,
} from "../lib/dailyQuiz";
import { fetchLeaderboard, rankWithYou, type Leaderboard } from "../lib/leaderboardApi";
import { EXAMPLE_CROWD_PICKS } from "../lib/leaderboardFixtures";
import type { QuizResult, SessionStats } from "../lib/quiz";

type Mode = "daily" | "practice";

export function DailyQuiz() {
  const [mode, setMode] = useState<Mode>("daily");
  const [today, setToday] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakState>(emptyStreak);
  // Ref, not state: onAnswer and onSetComplete fire in the same click.
  const answers = useRef<QuizResult[]>([]);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Date, storage and clock are browser-only; read after mount so static export stays stable.
  useEffect(() => {
    const key = dateKey();
    setToday(key);
    setStreak(loadStreak(window.localStorage));
    setHandle(getOrCreateHandle(window.localStorage));
    fetchLeaderboard(key).then(setBoard);
    const tick = () => {
      setCountdown(msUntilNextSet());
      if (dateKey() !== key) window.location.reload();
    };
    tick();
    const t = window.setInterval(tick, 30_000);
    return () => window.clearInterval(t);
  }, []);

  const items = useMemo(() => (today ? dailySet(today) : []), [today]);
  const todays = streak.history.find((h) => h.date === today);
  const doneToday = Boolean(todays);
  const stats = today ? dailyStats(streak, today) : null;
  const ranked = useMemo(
    () =>
      board && handle
        ? rankWithYou(
            board.rows,
            todays ? { handle, score: todays.credit, streak: visibleStreak(streak, today!) } : null,
          )
        : [],
    [board, handle, todays, streak, today],
  );

  function onSetComplete(s: SessionStats) {
    if (!today) return;
    const next = recordDaily(streak, {
      date: today,
      credit: s.credit_total,
      answered: s.answered,
      results: answers.current.slice(-DAILY_SET_SIZE),
    });
    setStreak(next);
    saveStreak(window.localStorage, next);
  }

  async function share() {
    if (!today || !todays?.results) return;
    const url = `${window.location.origin}${window.location.pathname}`;
    try {
      await navigator.clipboard.writeText(shareText(today, todays.results, url));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="daily-bar">
        <div className="daily-tabs" role="tablist" aria-label="Quiz mode">
          {(["daily", "practice"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`daily-tab${mode === m ? " is-active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "daily" ? "Today's 3" : "Practice"}
            </button>
          ))}
        </div>
        {stats ? (
          <div className="daily-stats" aria-live="polite">
            <span><strong>{stats.current_streak}</strong> streak</span>
            <span><strong>{stats.best_streak}</strong> best</span>
            <span><strong>{stats.days_played}</strong> played</span>
            {handle ? <span className="muted">you are {handle}</span> : null}
          </div>
        ) : null}
      </div>

      {mode === "daily" ? (
        doneToday && todays ? (
          <section className="daily-done" aria-labelledby="done-head">
            <h2 id="done-head">Today&apos;s 3 are done</h2>
            {todays.results ? (
              <p className="daily-grid" aria-label="Your results">
                {todays.results.map((r, i) => (
                  <span key={i} className={`daily-cell is-${r}`}>{r === "near_tie" ? "½" : ""}</span>
                ))}
              </p>
            ) : null}
            <p>
              {todays.credit} of {todays.answered} points
              {countdown != null ? ` · next set in ${formatCountdown(countdown)} (midnight New York time)` : ""}
            </p>
            {todays.results ? (
              <button type="button" className="daily-tab is-active" onClick={share}>
                {copied ? "Copied" : "Share (no spoilers)"}
              </button>
            ) : null}
            {stats ? (
              <div className="daily-dist">
                <h3>Right calls per day</h3>
                {stats.right_call_distribution.map((n, k) => (
                  <div key={k} className="dist-row">
                    <span>{k}</span>
                    <span className="dist-bar" style={{ width: `${Math.max(4, (n / Math.max(1, ...stats.right_call_distribution)) * 100)}%` }}>{n}</span>
                  </div>
                ))}
              </div>
            ) : null}
            <button type="button" className="daily-tab" onClick={() => setMode("practice")}>
              Keep playing in Practice
            </button>
          </section>
        ) : items.length ? (
          <QuizGame
            key={`daily-${today}`}
            items={items}
            onAnswer={(r) => answers.current.push(r)}
            onSetComplete={onSetComplete}
            crowd={EXAMPLE_CROWD_PICKS}
            crowdLabel="Example crowd picks (not real players):"
          />
        ) : null
      ) : (
        <QuizGame key="practice" crowd={EXAMPLE_CROWD_PICKS} crowdLabel="Example crowd picks (not real players):" />
      )}

      {ranked.length ? (
        <section className="daily-board" aria-labelledby="board-head">
          <h2 id="board-head">Today&apos;s leaderboard</h2>
          {board?.source === "example" ? (
            <p className="muted">Example leaderboard: sample handles, not real results.</p>
          ) : null}
          <ol>
            {ranked.map((e) => (
              <li key={e.handle} className={e.is_you ? "is-you" : undefined}>
                <span className="board-rank">{e.rank}</span>
                <span className="board-name">{e.is_you ? `${e.handle} (you)` : e.handle}</span>
                <span className="board-pts">{e.score} pts</span>
                <span className="board-streak">{e.streak}d</span>
              </li>
            ))}
          </ol>
          <p className="muted">Points: right call = 1, near-tie = ½. Finish today&apos;s 3 to get on the board.</p>
        </section>
      ) : null}
    </>
  );
}
