"use client";

import { useEffect, useMemo, useState } from "react";
import { QuizGame } from "./QuizGame";
import {
  dailySet,
  dateKey,
  emptyStreak,
  loadStreak,
  recordDaily,
  saveStreak,
  visibleStreak,
  withYou,
  type StreakState,
} from "../lib/dailyQuiz";
import { fixtureLeaderboard } from "../lib/leaderboardFixtures";
import type { SessionStats } from "../lib/quiz";

type Mode = "daily" | "practice";

export function DailyQuiz() {
  const [mode, setMode] = useState<Mode>("daily");
  const [today, setToday] = useState<string | null>(null);
  const [streak, setStreak] = useState<StreakState>(emptyStreak);

  // Date and storage are browser-only; read after mount so static export stays stable.
  useEffect(() => {
    setToday(dateKey());
    setStreak(loadStreak(window.localStorage));
  }, []);

  const items = useMemo(() => (today ? dailySet(today) : []), [today]);
  const doneToday = today != null && streak.last_completed === today;
  const todays = streak.history.find((h) => h.date === today);
  const board = useMemo(
    () =>
      today
        ? withYou(
            fixtureLeaderboard(today),
            todays ? { points: todays.credit, current_streak: visibleStreak(streak, today) } : null,
          )
        : null,
    [today, todays, streak],
  );

  function onSetComplete(s: SessionStats) {
    if (!today) return;
    const next = recordDaily(streak, { date: today, credit: s.credit_total, answered: s.answered });
    setStreak(next);
    saveStreak(window.localStorage, next);
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
        {today ? (
          <p className="daily-streak" aria-live="polite">
            <strong>{visibleStreak(streak, today)}</strong>-day streak · best {streak.best}
            {doneToday ? " · today done ✓" : ""}
          </p>
        ) : null}
      </div>

      {mode === "daily" ? (
        items.length ? (
          <QuizGame key={`daily-${today}`} items={items} onSetComplete={onSetComplete} />
        ) : null
      ) : (
        <QuizGame key="practice" />
      )}

      {board ? (
        <section className="daily-board" aria-labelledby="board-head">
          <h2 id="board-head">Today&apos;s leaderboard</h2>
          {board.source === "example" ? <p className="muted">{board.source_note}</p> : null}
          <ol>
            {board.entries.map((e) => (
              <li key={e.display_name} className={e.is_you ? "is-you" : undefined}>
                <span className="board-rank">{e.rank}</span>
                <span className="board-name">{e.display_name}</span>
                <span className="board-pts">{e.points} pts</span>
                <span className="board-streak">{e.current_streak}d</span>
              </li>
            ))}
          </ol>
          <p className="muted">
            Points: right call = 1, near-tie = ½. Finish today&apos;s 3 to get on the board.
          </p>
        </section>
      ) : null}
    </>
  );
}
