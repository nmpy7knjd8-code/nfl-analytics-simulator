"use client";

import { useState } from "react";

export type ScrubPoint = { label: string; wp: string; score: string; text: string };

/** Drag through the game; readout shows the clock, score and win chance at that play. */
export function GameScrubber({ points }: { points: ScrubPoint[] }) {
  const [i, setI] = useState(points.length - 1);
  const p = points[i];
  return (
    <div className="gs-scrub">
      <label className="gs-scrub-label" htmlFor="gs-scrub">Scrub the game</label>
      <input id="gs-scrub" type="range" min={0} max={points.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-valuetext={`${p.label}, ${p.wp}`} />
      <p className="gs-readout" aria-live="polite">
        <strong>{p.label}</strong> · {p.score} · <strong>{p.wp}</strong>
        <span className="gs-readout-text">{p.text}</span>
      </p>
    </div>
  );
}
