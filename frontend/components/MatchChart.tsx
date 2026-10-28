"use client";

import { useEffect, useMemo, useState } from "react";
import { LETTERS, makeRound, score, type ChartGame, type ChartsFile } from "../lib/matchChart";
import { Header, Trademark } from "./SimpleGame";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const SEASON = 2025;
const W = 300, H = 110, OTW = 26;

function Chart({ g, letter }: { g: ChartGame; letter: string }) {
  const plotW = g.ot ? W - OTW : W;
  const pts = g.wp.map((p, i) => `${((i / (g.wp.length - 1)) * plotW).toFixed(1)},${((1 - p) * H).toFixed(1)}`).join(" ");
  return (
    <figure className="mc-chart">
      <figcaption className="mc-letter">{letter}</figcaption>
      <svg viewBox={`-2 -2 ${W + 4} ${H + 18}`} role="img" aria-label={`Chart ${letter}: home team's win chance through four quarters${g.ot ? ", then overtime" : ""}`}>
        <rect x={0} y={0} width={plotW} height={H} fill="#f7f8fa" />
        {[1, 2, 3].map((q) => <line key={q} x1={(plotW * q) / 4} x2={(plotW * q) / 4} y1={0} y2={H} stroke="#e0e0e0" />)}
        <line x1={0} x2={plotW} y1={H / 2} y2={H / 2} stroke="#bdbdbd" strokeDasharray="4 4" />
        <polyline points={pts} fill="none" stroke="#1E5BFF" strokeWidth={2.5} strokeLinejoin="round" />
        {g.ot ? (
          <g>
            <rect x={plotW + 2} y={0} width={OTW - 2} height={H} fill="#e8e8e8" />
            <text x={plotW + OTW / 2 + 1} y={H / 2 + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="#757575">OT</text>
          </g>
        ) : null}
        {["Q1", "Q2", "Q3", "Q4"].map((q, i) => <text key={q} x={(plotW * (i + 0.5)) / 4} y={H + 14} textAnchor="middle" fontSize={11} fill="#757575">{q}</text>)}
      </svg>
    </figure>
  );
}

export function MatchChart() {
  const [file, setFile] = useState<ChartsFile | null>(null);
  const [err, setErr] = useState(false);
  const [guesses, setGuesses] = useState<(number | null)[]>([null, null, null]);
  const [checked, setChecked] = useState(false);
  const [seed, setSeed] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetch(`${BASE}/data/charts/${SEASON}.json`).then((r) => (r.ok ? r.json() : Promise.reject())).then(setFile).catch(() => setErr(true));
  }, []);

  const round = useMemo(() => (file ? makeRound(file, seed) : null), [file, seed]);
  const results = round && checked ? score(round.chartOrder, guesses) : null;
  const ready = guesses.every((g) => g !== null);

  const pick = (gi: number, slot: number) => {
    if (checked) return;
    setGuesses((prev) => prev.map((s, i) => (i === gi ? slot : s === slot ? null : s)));
  };
  const next = () => { setSeed((s) => `${s}+`); setGuesses([null, null, null]); setChecked(false); };

  return (
    <div className="sg-app kb">
      <Header right="Match the chart" />
      <h1 className="kb-h1">Match the chart</h1>
      <p className="kb-lede">Each chart shows the home team&apos;s chance to win, minute by minute. Match each final score to its chart.</p>

      {err ? <p className="oh-empty">Couldn&apos;t load the charts. Try again later.</p> : null}
      {!round ? (!err ? <p className="kb-note">Loading…</p> : null) : (
        <>
          <section className="kb-hero mc-charts">
            {round.chartOrder.map((gi, slot) => <Chart key={slot} g={round.games[gi]} letter={LETTERS[slot]} />)}
            <p className="mc-key">Higher = home team more likely to win. Dashed = even.</p>
          </section>

          <section className="kb-hero ch-pick">
            {round.games.map((g, gi) => {
              const ok = results?.[gi];
              return (
                <div key={g.gameId} className={`mc-row${results ? (ok ? " is-ok" : " is-bad") : ""}`}>
                  <div className="mc-game">
                    <div><strong>{g.away}</strong> {g.awayScore} at <strong>{g.home}</strong> {g.homeScore}{g.ot ? " (OT)" : ""}</div>
                    <div className="mc-sub">Week {g.week}, {SEASON}{results ? (ok ? " · Right" : ` · It was ${LETTERS[round.chartOrder.indexOf(gi)]}`) : ""}</div>
                  </div>
                  <div className="mc-chips" role="radiogroup" aria-label={`Chart for ${g.away} at ${g.home}`}>
                    {LETTERS.map((L, slot) => (
                      <button key={L} type="button" role="radio" aria-checked={guesses[gi] === slot} className={`mc-chip${guesses[gi] === slot ? " is-on" : ""}`} onClick={() => pick(gi, slot)} disabled={checked}>{L}</button>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>

          {results ? (
            <>
              <p className="mc-total">{results.filter(Boolean).length} of 3 right</p>
              <button type="button" className="sg-btn" onClick={next}>Next three</button>
            </>
          ) : (
            <button type="button" className="sg-btn" disabled={!ready} onClick={() => setChecked(true)}>Check</button>
          )}
        </>
      )}

      <p className="kb-note">Charts stop at the end of the 4th quarter. Real {SEASON} games. Data: nflverse play-by-play.{file?.stub ? " Preview numbers." : ""}</p>
      <Trademark />
    </div>
  );
}
