"use client";

import { useState, useSyncExternalStore } from "react";
import { goRates, kickTooFar, kickPartlyTooFar, pct, spotLabel, type GoBand } from "../lib/goRates";
import { Header, Trademark } from "./SimpleGame";

const bandName = (b: GoBand) => `${spotLabel(b.max)} to ${spotLabel(b.min)}`;
const BLUE = [30, 91, 255] as const;
const shade = (r: number) => `rgba(${BLUE[0]}, ${BLUE[1]}, ${BLUE[2]}, ${0.08 + 0.92 * r})`;

// Charts UI owns HeatMap. Minimal contrast patch: pick each cell's ink from
// the fill composited over the page background. White when relative luminance
// is under ~0.18, else black, so every numbered cell stays at least 4.5:1.
function srgbToLin(channel: number) {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number) {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function cellInk(rate: number, dark: boolean) {
  const a = 0.08 + 0.92 * rate;
  const [br, bg, bb] = dark ? [0, 0, 0] : [0xf2, 0xf2, 0xf7];
  const r = BLUE[0] * a + br * (1 - a);
  const g = BLUE[1] * a + bg * (1 - a);
  const b = BLUE[2] * a + bb * (1 - a);
  return relativeLuminance(r, g, b) < 0.18 ? "#fff" : "#000";
}

function subscribeTheme(onStoreChange: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", onStoreChange);
  const mo = new MutationObserver(onStoreChange);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", onStoreChange);
    mo.disconnect();
  };
}

function getDark() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function useDark() {
  return useSyncExternalStore(subscribeTheme, getDark, () => false);
}

export function HeatMap() {
  const dark = useDark();
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
        <div className="hm-scroll"><div className="hm-grid" role="grid" aria-label="Go-for-it rate by spot and yards to go">
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
                    style={cn < f.minPlays ? undefined : { background: shade(rate), color: cellInk(rate, dark) }}
                    aria-label={`4th and ${d === 10 ? "10 or more" : d}, ${bandName(b)}: went for it ${pct(cw, cn)}% of ${cn} plays`}
                    onClick={() => setSel([r, c])}
                  >
                    {cn < f.minPlays ? "" : pct(cw, cn)}
                  </button>
                );
              })}
            </div>
          ))}
        </div></div>
        <div className="hm-axis">↑ toward their end zone · % went for it</div>
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
        Data: nflverse play-by-play. Data through {f.dataThrough}.
      </p>
      <Trademark />
    </div>
  );
}
