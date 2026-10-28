"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gameFileUrl, isGameFileV2 } from "../lib/gameFileV2";
import {
  KIND_LABEL, NO_FILTER, buildFeed, chartPoints, filterFeed, metaLine, swingText, toggle, winLine,
  type FeedFilter, type FeedGame, type FeedPlay, type KindFilter,
} from "../lib/playFeed";
import { Header, Trademark } from "./SimpleGame";
import { TeamLogo } from "./TeamLogo";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const DEFAULT_FEED_GAME = "2023_01_DET_KC";

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; game: FeedGame };

function Chip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" className={`pf-chip${on ? " is-on" : ""}`} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
}

/** Home win chance as a bar: away side gray on the left, home side blue on the right. */
function WinBar({ g, wp }: { g: FeedGame; wp: number }) {
  const w = winLine(g, wp);
  const home = Math.round(wp * 100);
  return (
    <span className="pf-bar" aria-label={`${w.team} ${w.pct}% to win`}>
      <span className="pf-bar-a">{g.away}</span>
      <span className="pf-bar-track" aria-hidden="true">
        <span className="pf-bar-fill" style={{ width: `${home}%` }} />
      </span>
      <span className="pf-bar-h">{g.home}</span>
      <b className="pf-bar-pct">{w.team} {w.pct}%</b>
    </span>
  );
}

function Chart({ g, play, onClose }: { g: FeedGame; play: FeedPlay; onClose: () => void }) {
  const W = 340, H = 170, L = 30, R = 8, T = 10, B = 22;
  const pts = chartPoints(g.plays);
  const span = Math.max(3600, pts.at(-1)?.t ?? 3600);
  const x = (t: number) => L + (t / span) * (W - L - R);
  const y = (wp: number) => T + (1 - wp) * (H - T - B);
  const path = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.wp).toFixed(1)}`).join(" ");
  const w = winLine(g, play.homeWp);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <section className="pf-sheet" role="dialog" aria-modal="true" aria-label="Win chance chart">
      <p className="pf-meta">{metaLine(play)}</p>
      <p className="pf-sheet-text">{play.text}</p>
      <p className="pf-sheet-wp"><b>{w.team} {w.pct}% to win</b> after this play · {swingText(g, play)}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="pf-chart" role="img" aria-label={`${g.home} win chance through the game, marked at this play`}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0.5 ? "#bbb" : "#e6e6e6"} strokeDasharray={v === 0.5 ? "3 3" : undefined} />
          </g>
        ))}
        <text x={L - 4} y={y(1) + 4} textAnchor="end" className="pf-ax">{g.home}</text>
        <text x={L - 4} y={y(0) + 4} textAnchor="end" className="pf-ax">{g.away}</text>
        {[1, 2, 3, 4].map((q) => (
          <text key={q} x={x((q - 0.5) * 900)} y={H - 6} textAnchor="middle" className="pf-ax">Q{q}</text>
        ))}
        {[900, 1800, 2700].map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke="#eee" />)}
        <path d={path} fill="none" stroke="#000" strokeWidth={1.6} />
        <line x1={x(play.t)} x2={x(play.t)} y1={T} y2={H - B} stroke="#1E5BFF" strokeWidth={1.5} />
        <circle cx={x(play.t)} cy={y(play.homeWp)} r={6} fill="#1E5BFF" stroke="#fff" strokeWidth={2} />
      </svg>
      <p className="pf-legend">Top line: {g.home} sure to win. Bottom: {g.away}.</p>
      <button ref={close} type="button" className="sg-next pf-back" onClick={onClose}>Back to plays</button>
    </section>
  );
}

export function PlayFeedC6({ gameId = DEFAULT_FEED_GAME }: { gameId?: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState<FeedFilter>(NO_FILTER);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    setLoad({ state: "loading" });
    fetch(gameFileUrl(gameId, BASE), { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((doc: unknown) => {
        if (!isGameFileV2(doc)) throw new Error("bad file");
        setLoad({ state: "ready", game: buildFeed(doc) });
      })
      .catch((e: unknown) => { if ((e as Error)?.name !== "AbortError") setLoad({ state: "error" }); });
    return () => ctrl.abort();
  }, [gameId, attempt]);
  const g = load.state === "ready" ? load.game : null;
  const rows = useMemo(() => (g ? filterFeed(g.plays, filter) : []), [g, filter]);
  const play = g && open ? g.plays.find((p) => p.id === open) ?? null : null;
  const closeChart = useCallback(() => {
    const id = open;
    setOpen(null);
    if (id) requestAnimationFrame(() => document.getElementById(`pf-${id}`)?.focus());
  }, [open]);
  const set = <K extends keyof FeedFilter>(k: K, v: FeedFilter[K]) => setFilter((f) => toggle(f, k, v));
  const active = [filter.team, filter.kind ? KIND_LABEL[filter.kind] : null, filter.qtr ? `Q${filter.qtr}` : null].filter(Boolean).join(", ");
  const any = filter.team != null || filter.qtr != null || filter.kind != null;

  return (
    <div className="sg-app pf-app">
      <Header right="Play feed" />
      {g ? (
        <div className="pf-game">
          <TeamLogo abbr={g.away} size={22} /><b>{g.away} {g.awayScore}</b>
          <span className="pf-at">@</span>
          <TeamLogo abbr={g.home} size={22} /><b>{g.home} {g.homeScore}</b>
          <span className="pf-wk">Week {g.week}, {g.season}</span>
        </div>
      ) : <div className="pf-game" aria-hidden="true" />}
      {play && g ? (
        <Chart g={g} play={play} onClose={closeChart} />
      ) : (
        <>
          <div className="pf-chips" role="group" aria-label="Filter plays">
            <Chip on={!any} label="All" onClick={() => setFilter(NO_FILTER)} />
            {g ? [g.away, g.home].map((t) => <Chip key={t} on={filter.team === t} label={t} onClick={() => set("team", t)} />) : null}
            {(Object.keys(KIND_LABEL) as KindFilter[]).map((k) => <Chip key={k} on={filter.kind === k} label={KIND_LABEL[k]} onClick={() => set("kind", k)} />)}
            {[1, 2, 3, 4].map((q) => <Chip key={q} on={filter.qtr === q} label={`Q${q}`} onClick={() => set("qtr", q)} />)}
          </div>
          <div className="pf-list" aria-busy={load.state === "loading"}>
            {load.state === "loading" ? (
              <>
                <p className="pf-status" aria-live="polite">Loading plays…</p>
                {[0, 1, 2, 3].map((i) => <div key={i} className="pf-row pf-skel" aria-hidden="true" />)}
              </>
            ) : load.state === "error" ? (
              <div className="pf-empty" role="alert">
                <p><b>Couldn’t load the plays.</b><br />Check your connection and try again.</p>
                <button type="button" className="sg-next pf-cta" onClick={() => setAttempt((a) => a + 1)}>Try again</button>
              </div>
            ) : !rows.length ? (
              <div className="pf-empty">
                <p><b>No plays match {active}.</b><br />Try fewer filters.</p>
                <button type="button" className="sg-btn sg-btn-c pf-cta" onClick={() => setFilter(NO_FILTER)}>Show all plays</button>
              </div>
            ) : (
              <>
                <p className="pf-status" aria-live="polite">{rows.length} {rows.length === 1 ? "play" : "plays"}{any ? ` · ${active}` : ""} · tap one for the chart</p>
                <ol className="pf-rows">
                  {rows.map((p) => (
                    <li key={p.id}>
                      <button type="button" id={`pf-${p.id}`} className={`pf-row${p.big ? " is-big" : ""}`} onClick={() => setOpen(p.id)}>
                        <span className="pf-meta">{metaLine(p)}{p.big ? <em className="pf-tag">Big play</em> : null}{p.scoring ? <em className="pf-tag">Score</em> : null}</span>
                        <span className="pf-text">{p.text}</span>
                        <WinBar g={g!} wp={p.homeWp} />
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        </>
      )}
      <Trademark />
    </div>
  );
}
