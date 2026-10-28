"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dailyStats, dateKey, formatScore, loadStreak, type DailyStats } from "../lib/daily";

export function StatsView() {
  const [s, setS] = useState<DailyStats | null>(null);
  useEffect(() => {
    let st;
    try {
      st = loadStreak(window.localStorage);
    } catch {
      st = loadStreak(undefined);
    }
    setS(dailyStats(st, dateKey(new Date())));
  }, []);
  if (!s) return <p className="fd-muted">Loading…</p>;
  if (!s.days_played) {
    return (
      <div className="fd-empty">
        <p>Your record starts with today&apos;s five.</p>
        <Link href="/daily/" className="fd-empty-btn">Play today&apos;s five</Link>
      </div>
    );
  }
  const max = Math.max(1, ...s.score_distribution);
  return (
    <>
      <dl className="fd-stats">
        <div><dt>Days played</dt><dd>{s.days_played}</dd></div>
        <div><dt>Streak</dt><dd>{s.current_streak}</dd></div>
        <div><dt>Best streak</dt><dd>{s.best_streak}</dd></div>
        <div><dt>Average</dt><dd>{s.average == null ? "—" : formatScore(Math.round(s.average * 10) / 10)}/5</dd></div>
      </dl>
      <h2>Scores</h2>
      <ol className="fd-dist" aria-label="Days by score">
        {s.score_distribution.map((n, k) => (
          <li key={k}>
            <span className="fd-dist-k">{k}</span>
            <span className="fd-dist-bar" style={{ width: `${Math.max(6, (n / max) * 100)}%` }}>{n}</span>
          </li>
        ))}
      </ol>
      <p className="fd-muted">Stats live only in this browser. Nothing is sent anywhere.</p>
    </>
  );
}
