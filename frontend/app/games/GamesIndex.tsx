"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { TeamLogo } from "../../components/TeamLogo";
import { humanDate } from "../../lib/drives";
import {
  SEASONS,
  gameCardHref,
  gamesInWeek,
  isSeasonIndex,
  seasonIndexUrl,
  weeksOf,
  type IndexGame,
  type Week,
} from "../../lib/gamePicker";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const DEFAULT_SEASON = 2023;
const DEFAULT_WEEK = 1;

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; games: IndexGame[] };
type Sheet = "season" | "week" | null;

function scoreParts(g: IndexGame): { away: string; home: string; awayWin: boolean; homeWin: boolean; pending: boolean } {
  if (g.away_score == null || g.home_score == null) {
    return { away: "—", home: "—", awayWin: false, homeWin: false, pending: true };
  }
  return {
    away: String(g.away_score),
    home: String(g.home_score),
    awayWin: g.away_score > g.home_score,
    homeWin: g.home_score > g.away_score,
    pending: false,
  };
}

export function GamesIndex({ built }: { built: string[] }) {
  const builtSet = useMemo(() => new Set(built), [built]);
  const [season, setSeason] = useState(DEFAULT_SEASON);
  const [week, setWeek] = useState(DEFAULT_WEEK);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [sheet, setSheet] = useState<Sheet>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: "loading" });
    fetch(seasonIndexUrl(season, BASE), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: unknown) => {
        if (!isSeasonIndex(d)) throw new Error("bad index");
        setLoad({ state: "ready", games: d.games });
      })
      .catch((e: unknown) => {
        if ((e as Error)?.name !== "AbortError") setLoad({ state: "error" });
      });
    return () => ctrl.abort();
  }, [season, attempt]);

  useEffect(() => {
    if (sheet) titleRef.current?.focus();
  }, [sheet]);

  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  const games = load.state === "ready" ? load.games : [];
  const weeks = useMemo(() => weeksOf(games), [games]);
  const wk: Week | undefined = weeks.find((w) => w.week === week) ?? weeks[0];
  const list = load.state === "ready" ? gamesInWeek(games, week) : [];
  const weekLabel = wk?.label ?? `Week ${week}`;

  const pickSeason = (s: number) => {
    setSeason(s);
    setWeek(DEFAULT_WEEK);
    setSheet(null);
  };
  const pickWeek = (w: number) => {
    setWeek(w);
    setSheet(null);
  };

  return (
    <>
      <div className="ios-picker" role="group" aria-label="Season and week">
        <button type="button" className="ios-picker-btn" aria-haspopup="dialog" aria-expanded={sheet === "season"} onClick={() => setSheet("season")}>
          {season}
        </button>
        <button type="button" className="ios-picker-btn" aria-haspopup="dialog" aria-expanded={sheet === "week"} onClick={() => setSheet("week")}>
          {weekLabel}
        </button>
      </div>

      {sheet ? (
        <div className="ios-sheet-back" onClick={() => setSheet(null)}>
          <div
            className="ios-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-sheet-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ios-sheet-bar">
              <h2 id="ios-sheet-title" className="ios-sheet-title" tabIndex={-1} ref={titleRef}>
                {sheet === "season" ? "Season" : "Week"}
              </h2>
              <button type="button" className="ios-sheet-close" onClick={() => setSheet(null)}>
                Close
              </button>
            </div>
            {sheet === "season" ? (
              <ul className="ios-list ios-sheet-list">
                {SEASONS.map((s) => (
                  <li key={s}>
                    <button type="button" className={`ios-list-row${s === season ? " is-selected" : ""}`} onClick={() => pickSeason(s)} aria-current={s === season ? "true" : undefined}>
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            ) : load.state === "ready" ? (
              <ul className="ios-list ios-sheet-list">
                {weeks.map((w) => (
                  <li key={w.week}>
                    <button type="button" className={`ios-list-row${w.week === week ? " is-selected" : ""}`} onClick={() => pickWeek(w.week)} aria-current={w.week === week ? "true" : undefined}>
                      {w.label}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="ios-games-status">Loading weeks…</p>
            )}
          </div>
        </div>
      ) : null}

      {load.state === "loading" ? <p className="ios-games-status" aria-live="polite">Loading {season} games…</p> : null}
      {load.state === "error" ? (
        <div className="ios-games-error" role="alert">
          <p>Couldn’t load the {season} games. Check your connection and try again.</p>
          <button type="button" className="ios-show-all" onClick={() => setAttempt((n) => n + 1)}>
            Try again
          </button>
        </div>
      ) : null}
      {load.state === "ready" && !list.length ? (
        <p className="ios-games-empty">No games in {weekLabel}. Pick another week.</p>
      ) : null}
      {list.length ? (
        <ul className="ios-list ios-games-list">
          {list.map((g) => {
            const s = scoreParts(g);
            const when = [weekLabel, g.date ? humanDate(g.date) : null, g.overtime ? "OT" : null].filter(Boolean).join(" · ");
            return (
              <li key={g.id}>
                <Link className="ios-list-row ios-game-row" href={gameCardHref(g.id, builtSet)}>
                  <span className="ios-game-teams">
                    <span className="ios-game-side">
                      <TeamLogo abbr={g.away} size={22} />
                      <span className="ios-game-abbr">{g.away}</span>
                      <span className={`ios-game-sc ios-nums${s.awayWin ? " is-winner" : ""}`}>{s.away}</span>
                    </span>
                    <span className="ios-game-side">
                      <TeamLogo abbr={g.home} size={22} />
                      <span className="ios-game-abbr">{g.home}</span>
                      <span className={`ios-game-sc ios-nums${s.homeWin ? " is-winner" : ""}`}>{s.home}</span>
                    </span>
                    <span className="ios-game-meta">{when}</span>
                  </span>
                  <span className="ios-chevron" aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </>
  );
}
