"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dailyStats, dateKey, formatScore, loadStreak, type DailyStats } from "../lib/daily";
import { calendarCells, shieldStreak, type DayMark } from "../lib/shields";
import { Header, Trademark } from "./SimpleGame";

type View = { s: DailyStats; streak: number; shieldLeft: boolean; cells: { date: string; mark: DayMark }[] };

const MARK_TEXT: Record<DayMark, string> = { played: "played", shield: "shield used", missed: "missed", future: "", before: "" };

export function StatsView() {
  const [v, setV] = useState<View | null>(null);
  useEffect(() => {
    let st;
    try { st = loadStreak(window.localStorage); } catch { st = loadStreak(undefined); }
    const today = dateKey(new Date());
    const sh = shieldStreak(st.history.map((h) => h.date), today);
    setV({ s: dailyStats(st, today), streak: sh.streak, shieldLeft: !sh.shieldUsedThisWeek, cells: calendarCells(sh, today) });
  }, []);
  return (
    <div className="sg-app st">
      <Header right="Stats" />
      <h1 className="st-h1">Your stats</h1>
      {!v ? <p className="sg-note" role="status">Loading…</p> : !v.s.days_played ? (
        <div className="st-empty">
          <p>Play today to start your calendar.</p>
          <Link href="/daily/" className="sg-next">Play today&apos;s five</Link>
        </div>
      ) : (
        <>
          <dl className="st-tiles">
            <div><dt>Played</dt><dd>{v.s.days_played}</dd></div>
            <div><dt>Streak</dt><dd>{v.streak}</dd></div>
            <div><dt>Best</dt><dd>{Math.max(v.s.best_streak, v.streak)}</dd></div>
            <div><dt>Average</dt><dd>{v.s.average == null ? "—" : formatScore(Math.round(v.s.average * 10) / 10)}</dd></div>
          </dl>
          <p className="st-shield-line">{v.shieldLeft ? "Shield ready: miss one day this week and your streak stays." : "Shield used this week. A new one comes Monday."}</p>
          <div className="st-cal" role="list" aria-label="Last five weeks">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="st-dow" aria-hidden="true">{d}</span>)}
            {v.cells.map((c) => (
              <span key={c.date} role="listitem" className={`st-d st-${c.mark}`} aria-label={MARK_TEXT[c.mark] ? `${c.date} ${MARK_TEXT[c.mark]}` : c.date}>
                {Number(c.date.slice(8))}
              </span>
            ))}
          </div>
          <p className="st-key"><i className="st-played" /> Played <i className="st-shield-k" /> Shield <i className="st-missed" /> Missed</p>
          <p className="sg-note">Saved only in this browser.</p>
        </>
      )}
      <Trademark />
    </div>
  );
}
