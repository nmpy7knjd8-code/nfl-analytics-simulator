"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  SEASONS, finalScore, gamesInWeek, isSeasonIndex, matchup, searchGames, seasonIndexUrl, weeksOf,
  type IndexGame,
} from "../lib/gamePicker";
import { TeamLogo } from "./TeamLogo";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Step = "season" | "week" | "games";
type Load = { state: "loading" } | { state: "error" } | { state: "ready"; games: IndexGame[] };

function GameRow({ g, current, sub, onPick }: { g: IndexGame; current: boolean; sub?: string; onPick: (id: string) => void }) {
  return (
    <li>
      <button type="button" className={`gp-game${current ? " is-on" : ""}`} aria-current={current ? "true" : undefined} onClick={() => onPick(g.id)}>
        <TeamLogo abbr={g.away} size={24} />
        <TeamLogo abbr={g.home} size={24} />
        <span className="gp-mu">{matchup(g)}{sub ? <small>{sub}</small> : null}</span>
        <span className="gp-sc">{finalScore(g)}</span>
      </button>
    </li>
  );
}

/** Season → week → game, with a quick team search over the chosen season. Lives inside the feed card. */
export function GamePicker({ currentId, startSeason, onPick, onClose }: {
  currentId: string; startSeason: number; onPick: (id: string) => void; onClose: () => void;
}) {
  const [season, setSeason] = useState(startSeason);
  const [week, setWeek] = useState<number | null>(null);
  const [step, setStep] = useState<Step>("season");
  const [q, setQ] = useState("");
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: "loading" });
    fetch(seasonIndexUrl(season, BASE), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: unknown) => { if (!isSeasonIndex(d)) throw new Error("bad index"); setLoad({ state: "ready", games: d.games }); })
      .catch((e: unknown) => { if ((e as Error)?.name !== "AbortError") setLoad({ state: "error" }); });
    return () => ctrl.abort();
  }, [season, attempt]);
  useEffect(() => { head.current?.focus(); }, [step]);

  const games = load.state === "ready" ? load.games : [];
  const weeks = useMemo(() => weeksOf(games), [games]);
  const wk = weeks.find((w) => w.week === week);
  const found = useMemo(() => searchGames(games, q), [games, q]);
  const searching = q.trim().length > 0 && step !== "season";
  const back = () => { setQ(""); setStep(step === "games" ? "week" : "season"); };
  const title = step === "season" ? "Pick a season" : step === "week" ? `${season} · Pick a week` : `${season} · ${wk?.label ?? ""}`;

  const body = () => {
    if (step === "season")
      return (
        <div className="gp-grid gp-grid-2">
          {SEASONS.map((s) => (
            <button key={s} type="button" className={`gp-cell${s === season ? " is-on" : ""}`} aria-pressed={s === season}
              onClick={() => { setSeason(s); setWeek(null); setStep("week"); }}>{s}</button>
          ))}
        </div>
      );
    if (load.state === "loading")
      return (
        <>
          <p className="pf-status" aria-live="polite">Loading {season} games…</p>
          {[0, 1, 2, 3].map((i) => <div key={i} className="gp-skel" aria-hidden="true" />)}
        </>
      );
    if (load.state === "error")
      return (
        <div className="pf-empty" role="alert">
          <p><b>Couldn’t load the {season} games.</b><br />Check your connection and try again.</p>
          <button type="button" className="sg-next pf-cta" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
        </div>
      );
    if (searching)
      return found.length ? (
        <>
          <p className="pf-status" aria-live="polite">{found.length} {season} games for “{q.trim()}”</p>
          <ol className="gp-list">{found.map((g) => <GameRow key={g.id} g={g} current={g.id === currentId} sub={weeks.find((w) => w.week === g.week)?.label} onPick={onPick} />)}</ol>
        </>
      ) : (
        <div className="pf-empty"><p><b>No {season} games for “{q.trim()}”.</b><br />Try a team like KC or Chiefs.</p></div>
      );
    if (step === "week")
      return (
        <div className="gp-grid gp-grid-4">
          {weeks.map((w) => (
            <button key={w.week} type="button" className={`gp-cell${w.short.length > 2 ? " gp-wide" : ""}${w.week === week ? " is-on" : ""}`}
              aria-label={w.label} onClick={() => { setWeek(w.week); setStep("games"); }}>{w.short}</button>
          ))}
        </div>
      );
    const list = gamesInWeek(games, week ?? 0);
    return list.length ? (
      <ol className="gp-list">{list.map((g) => <GameRow key={g.id} g={g} current={g.id === currentId} onPick={onPick} />)}</ol>
    ) : (
      <div className="pf-empty">
        <p><b>No games {wk?.label ? `in ${wk.label}` : "that week"}.</b><br />Pick another week.</p>
        <button type="button" className="sg-btn sg-btn-c pf-cta" onClick={back}>Pick a week</button>
      </div>
    );
  };

  return (
    <section className="gp" aria-label="Pick a game">
      <div className="gp-top">
        {step !== "season" ? <button type="button" className="gp-back" onClick={back} aria-label="Back">‹</button> : null}
        <h2 className="gp-title" tabIndex={-1} ref={head}>{title}</h2>
        <button type="button" className="gp-close" onClick={onClose}>Close</button>
      </div>
      {step !== "season" ? (
        <input className="gp-search" type="search" inputMode="search" autoComplete="off" placeholder={`Find a team in ${season} (KC, Chiefs)`}
          aria-label={`Find a team's ${season} games`} value={q} onChange={(e) => setQ(e.target.value)} />
      ) : null}
      <div className="gp-body">{body()}</div>
    </section>
  );
}
