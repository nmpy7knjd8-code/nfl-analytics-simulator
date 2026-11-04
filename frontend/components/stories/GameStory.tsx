"use client";

import { useEffect, useState } from "react";
import { Header, Trademark } from "../SimpleGame";
import { TeamLogo } from "../TeamLogo";
import { feedHref } from "../../lib/gamePicker";
import { gameFileUrl, isGameFileV2 } from "../../lib/gameFileV2";
import { buildStory, gameIdFromQuery, playIdFromHash, weekLine, type Story, type StoryBeat } from "../../lib/stories/gameStory";
import "./game-story.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
type Load = { state: "loading" } | { state: "nogame" } | { state: "error" } | { state: "ready"; story: Story };

const when = (b: StoryBeat) => `${b.qtr > 4 ? "OT" : `Q${b.qtr}`} · ${b.clock.replace(/^0(\d)/, "$1")}${b.team ? ` · ${b.team} ball` : ""}`;

function Chart({ s }: { s: Story }) {
  const W = 340, H = 150, L = 34, R = 8, T = 8, B = 20;
  const x = (t: number) => L + (t / 3600) * (W - L - R);
  const y = (wp: number) => T + (1 - wp) * (H - T - B);
  const d = s.points.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.wp).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="gs-chart" role="img" aria-label={`${s.game.home} chance to win through regulation`}>
      <line x1={L} x2={W - R} y1={y(0.5)} y2={y(0.5)} stroke="#bbb" strokeDasharray="3 3" />
      {[900, 1800, 2700].map((t) => <line key={t} x1={x(t)} x2={x(t)} y1={T} y2={H - B} stroke="#eee" />)}
      <text x={L - 4} y={y(1) + 8} textAnchor="end" className="gs-ax">{s.game.home}</text>
      <text x={L - 4} y={y(0)} textAnchor="end" className="gs-ax">{s.game.away}</text>
      {[1, 2, 3, 4].map((q) => <text key={q} x={x((q - 0.5) * 900)} y={H - 5} textAnchor="middle" className="gs-ax">Q{q}</text>)}
      <path d={d} fill="none" stroke="#000" strokeWidth={1.6} />
    </svg>
  );
}

export function GameStory() {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);

  useEffect(() => {
    const id = gameIdFromQuery(window.location.search);
    setFocus(playIdFromHash(window.location.hash));
    if (!id) { setLoad({ state: "nogame" }); return; }
    let live = true;
    setLoad({ state: "loading" });
    fetch(gameFileUrl(id, BASE))
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (live) { if (!isGameFileV2(d)) throw new Error("shape"); setLoad({ state: "ready", story: buildStory(d) }); } })
      .catch(() => live && setLoad({ state: "error" }));
    return () => { live = false; };
  }, [attempt]);

  useEffect(() => {
    const h = () => setFocus(playIdFromHash(window.location.hash));
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  useEffect(() => {
    if (load.state === "ready" && focus != null) document.getElementById(`play-${focus}`)?.scrollIntoView({ block: "center" });
  }, [load, focus]);

  if (load.state !== "ready") {
    return (
      <div className="sg-app gs">
        <Header right="Game Story" />
        {load.state === "loading" ? (
          <div aria-busy="true" aria-label="Loading the game story"><div className="gs-skel" style={{ height: 120 }} /><div className="gs-skel" /><div className="gs-skel" /></div>
        ) : load.state === "error" ? (
          <div className="gs-empty" role="alert"><p>Couldn&apos;t load this game.</p>
            <button type="button" className="gs-oval gs-oval-fill" onClick={() => setAttempt((a) => a + 1)}>Try again</button></div>
        ) : (
          <div className="gs-empty"><p>Pick a game to read its story.</p><a className="gs-oval gs-oval-fill" href={`${BASE}/feed/`}>Pick a game</a></div>
        )}
        <Trademark />
      </div>
    );
  }

  const { story } = load;
  const g = story.game;
  const inBeats = focus != null && story.beats.some((b) => b.playId === focus);
  const extra = focus != null && !inBeats ? story.rows.get(focus) : undefined;
  const beat = (b: StoryBeat, n?: number) => (
    <li key={b.playId} id={`play-${b.playId}`} className={`gs-beat${b.playId === focus ? " is-on" : ""}`}>
      {n != null ? <span className="gs-n">{n}</span> : null}
      <div className="gs-beat-b">
        <p className="gs-sent">{b.sentence}</p>
        <p className="gs-meta">{when(b)}</p>
        <p className="gs-text">{b.text}</p>
      </div>
    </li>
  );
  return (
    <div className="sg-app gs">
      <Header right="Game Story" />
      <section className="gs-card" aria-label="Final score">
        <p className="gs-meta">{weekLine(g)}{g.overtime ? " · Overtime" : ""}</p>
        <div className="gs-score">
          <span><TeamLogo abbr={g.away} size={28} /> {g.away} <b>{g.awayScore}</b></span>
          <span className="gs-at">@</span>
          <span><TeamLogo abbr={g.home} size={28} /> {g.home} <b>{g.homeScore}</b></span>
        </div>
      </section>
      {extra ? (
        <section className="gs-card gs-focus" aria-label="The play you came from">
          <p className="gs-lbl">The play you came from</p>
          <ol className="gs-beats">{beat(extra)}</ol>
        </section>
      ) : null}
      <h1 className="gs-h1">How it swung</h1>
      {story.beats.length ? <ol className="gs-beats">{story.beats.map((b, i) => beat(b, i + 1))}</ol>
        : <div className="gs-empty"><p>No big swings in this game.</p></div>}
      {story.points.length > 1 ? (<><h2 className="gs-h2">Chance to win</h2><Chart s={story} />
        {g.overtime ? <p className="gs-note">Overtime isn&apos;t charted.</p> : null}</>) : null}
      <a className="gs-oval" href={feedHref(g.id, BASE)}>Every play</a>
      <p className="gs-note">Plays and win chance from nflverse play-by-play.</p>
      <Trademark />
    </div>
  );
}
