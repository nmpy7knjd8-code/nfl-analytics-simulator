"use client";

import { useEffect, useState } from "react";
import { dailySet, dateKey, rankedValues } from "../lib/daily";
import { CHOICE_NAME, gameText, pts, scoreboardText } from "../lib/dailyView";
import type { QuizChoice } from "../lib/quiz";
import type { DailyItem } from "../lib/daily";

/** Yesterday's closest call (smallest gap between the top two options). */
export function toughestCall(items: DailyItem[]): DailyItem | null {
  let best: { it: DailyItem; gap: number } | null = null;
  for (const it of items) {
    const r = rankedValues(it);
    if (r.length < 2) continue;
    const gap = r[0][1] - r[1][1];
    if (!best || gap < best.gap) best = { it, gap };
  }
  return best?.it ?? null;
}

export function YesterdayCall() {
  const [item, setItem] = useState<DailyItem | null>(null);
  useEffect(() => {
    const [yy, mm, dd] = dateKey(new Date()).split("-").map(Number);
    const key = new Date(Date.UTC(yy, mm - 1, dd - 1)).toISOString().slice(0, 10);
    setItem(toughestCall(dailySet(key)));
  }, []);
  const r = item ? rankedValues(item) : [];
  const coach = item?.historical_action ? CHOICE_NAME[item.historical_action as QuizChoice] ?? item.historical_action : "—";
  return (
    <section className="fd-panel" aria-labelledby="fd-yday">
      <h2 id="fd-yday">Yesterday&apos;s toughest call</h2>
      {item && r.length > 1 ? (
        <>
          <p className="fd-scoreboard">{scoreboardText(item)}</p>
          <p className="fd-game">{gameText(item)}</p>
          <p>
            Coach: {coach} · Model: {CHOICE_NAME[r[0][0]]} by {pts(r[0][1] - r[1][1])} over {CHOICE_NAME[r[1][0]]}
          </p>
        </>
      ) : (
        <p className="fd-muted">Loading…</p>
      )}
      <p className="fd-muted">Crowd split: not collected yet. We don&apos;t store anyone&apos;s picks, so there is no crowd number to show.</p>
    </section>
  );
}
