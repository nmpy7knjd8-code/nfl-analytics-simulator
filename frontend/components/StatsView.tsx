"use client";

import { EmptyState } from "./EmptyState";
import { useEffect, useState } from "react";
import Link from "next/link";
import { dailyStats, dateKey, formatScore, loadStreak, setNumber, shiftDay, shortDate, streakCalendar, timeoutAvailable, type CalendarDay, type DailyStats } from "../lib/daily";
import { ARCHIVE_START, coachTally, type CoachTally } from "../lib/batch1";

const DAY_NAME: Record<CalendarDay["state"], string> = { played: "played", shield: "saved by a timeout", missed: "missed", today: "today", future: "" };

export function StatsView() {
  const [s, setS] = useState<DailyStats | null>(null);
  const [cal, setCal] = useState<CalendarDay[][]>([]);
  const [coach, setCoach] = useState<CoachTally | null>(null);
  const [today, setToday] = useState<string>("");
  const [timeout, setTimeoutLeft] = useState(false);
  useEffect(() => {
    let st;
    try {
      st = loadStreak(window.localStorage);
    } catch {
      st = loadStreak(undefined);
    }
    const t = dateKey(new Date());
    setToday(t);
    setS(dailyStats(st, t));
    setCal(streakCalendar(st, t, 12));
    setCoach(coachTally(st.history.flatMap((h) => h.calls ?? [])));
    setTimeoutLeft(timeoutAvailable(st, t));
  }, []);
  if (!s) return <p className="fd-muted">Loading…</p>;
  const past = Array.from({ length: 7 }, (_, i) => shiftDay(today, -(i + 1))).filter((k) => k >= ARCHIVE_START);
  const archive = (
    <section aria-labelledby="fd-arch-title">
      <h2 id="fd-arch-title">Replay a past set</h2>
      <ul className="fd-archive">
        {past.map((k) => (
          <li key={k}><Link href={`/?d=${k}`}>#{setNumber(k)} · {shortDate(k)}</Link></li>
        ))}
      </ul>
      <p className="fd-muted">Archive sets don&apos;t count toward your streak.</p>
    </section>
  );
  if (!s.days_played) return <><EmptyState kind="no-history" title="Your record starts with today's five." body={<p>Play today&apos;s set to start your streak on this device.</p>} action={{ label: "Play today's 5", href: "/" }} />{archive}</>;
  const max = Math.max(1, ...s.score_distribution);
  return (
    <>
      <dl className="fd-stats">
        <div><dt>Days played</dt><dd>{s.days_played}</dd></div>
        <div><dt>Current streak</dt><dd>{s.current_streak}</dd></div>
        <div><dt>Best streak</dt><dd>{s.best_streak}</dd></div>
        <div><dt>Average</dt><dd>{s.average == null ? "—" : formatScore(Math.round(s.average * 10) / 10)}/5</dd></div>
      </dl>
      <h2>Days played</h2>
      <div className="fd-cal" role="img" aria-label={`Last 12 weeks: ${cal.flat().filter((d) => d.state === "played").length} days played, ${cal.flat().filter((d) => d.state === "shield").length} saved by a timeout`}>
        {cal.map((w, i) => (
          <div key={i} className="fd-cal-week">
            {w.map((d) => <span key={d.key} className={`fd-cal-day is-${d.state}`} title={d.state === "future" ? undefined : `${shortDate(d.key)}: ${DAY_NAME[d.state]}`} />)}
          </div>
        ))}
      </div>
      <p className="fd-muted fd-cal-key">
        <span className="fd-cal-day is-played" /> Played <span className="fd-cal-day is-shield" /> Timeout <span className="fd-cal-day is-missed" /> Missed.{" "}
        {timeout ? "This week's timeout is still available: miss one day and your streak is saved." : "This week's timeout is used."}
      </p>
      {coach && coach.calls ? (
        <>
          <h2>Coach vs. You</h2>
          <p>You agreed with coaches {coach.agreedPct}% of the time and beat their call {coach.beatPct}% ({coach.calls} calls).</p>
        </>
      ) : null}
      <h2>Scores</h2>
      <ol className="fd-dist" aria-label="Days by score">
        {s.score_distribution.map((n, k) => (
          <li key={k}>
            <span className="fd-dist-k">{k}</span>
            <span className="fd-dist-bar" style={{ width: `${Math.max(6, (n / max) * 100)}%` }}>{n}</span>
          </li>
        ))}
      </ol>
      {archive}
      <p className="fd-muted">Stats live only in this browser. Nothing is sent anywhere.</p>
    </>
  );
}
