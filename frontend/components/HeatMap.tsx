"use client";

import { useState } from "react";
import { goRates, kickTooFar, kickPartlyTooFar, pct, spotLabel, type GoBand } from "../lib/goRates";
import { Header, Trademark } from "./SimpleGame";

const bandName = (b: GoBand) => `${spotLabel(b.max)} to ${spotLabel(b.min)}`;
const shade = (r: number) => `rgba(30, 91, 255, ${0.08 + 0.92 * r})`;

export function HeatMap() {
  const f = goRates;
  const [sel, setSel] = useState<[number, number]>([0, 0]);
  const [row, col] = sel;
  const [n, went, fg, punt] = f.cells[row][col];
  const band = f.bands[col];
  const togo = f.distances[row];
  const few = n < f.minPlays;

  return (
    <div className="sg-app kb">
      <Header right="4th downs" />
      <h1 className="kb-h1">Where coaches go for it</h1>
      <p className="kb-lede">How often real coaches went for it on 4th down, by yards to go and spot on the field. Darker blue means they went more. Tap a square.</p>

      <section className="kb-hero hm-card">
        <div className="hm-grid" role="grid" aria-label="Go-for-it rate by spot and yards to go">
          <div className="hm-corner" aria-hidden="true">to go →</div>
          {f.distances.map((d) => <div key={d} className="hm-colh" aria-hidden="true">{d === 10 ? "10+" : d}</div>)}
          {f.bands.map((b, c) => (
            <div key={c} role="row" className="hm-row">
              <div className="hm-rowh">{spotLabel(b.max)}</div>
              {f.distances.map((d, r) => {
                const [cn, cw] = f.cells[r][c];
                const rate = cn ? cw / cn : 0;
                const on = r === row && c === col;
                return (
                  <button
                    key={d} type="button" role="gridcell"
                    className={`hm-cell${cn < f.minPlays ? " is-few" : ""}${on ? " is-on" : ""}`}
                    style={cn < f.minPlays ? undefined : { background: shade(rate), color: rate > 0.45 ? "#fff" : "#000" }}
                    aria-label={`4th and ${d === 10 ? "10 or more" : d}, ${bandName(b)}: went for it ${pct(cw, cn)}% of ${cn} plays`}
                    onClick={() => setSel([r, c])}
                  >
                    {cn < f.minPlays ? "" : pct(cw, cn)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="hm-axis">↑ toward the opponent&apos;s end zone · numbers are % that went for it</div>
      </section>

      <section className="kb-hero ch-pick" aria-live="polite">
        <div className="era-pick-h">4th-and-{togo === 10 ? "10+" : togo}, {bandName(band)}</div>
        {few ? (
          <p className="oh-empty">Only {n} real plays here, too few to show a rate.</p>
        ) : (
          <ul className="era-rows">
            <li><span className="era-dot" style={{ background: "#1E5BFF" }} />Went for it<strong>{pct(went, n)}%</strong></li>
            <li><span className="era-dot" style={{ background: "#9aa0a6" }} />{kickTooFar(f, band) ? "Kick (too far to kick)" : "Kicked a field goal"}<strong>{kickTooFar(f, band) ? "—" : `${pct(fg, n)}%`}</strong></li>
            <li><span className="era-dot" style={{ background: "#d9d9d9" }} />Punted<strong>{pct(punt, n)}%</strong></li>
            <li className="era-all">Real plays<strong>{n.toLocaleString()}</strong></li>
          </ul>
        )}
        {kickPartlyTooFar(f, band) ? <p className="kb-note">Kicks stop at {f.maxFgYards} yards, so from the back of this stretch a kick is too far.</p> : null}
      </section>

      <p className="kb-note">
        What coaches actually did on 4th down in the first four quarters, {f.seasons[0]}–{f.seasons[1]}. Blank squares have fewer than {f.minPlays} plays.
        Data: nflverse play-by-play.{f.stub ? " Preview numbers." : ""}
      </p>
      <Trademark />
    </div>
  );
}
