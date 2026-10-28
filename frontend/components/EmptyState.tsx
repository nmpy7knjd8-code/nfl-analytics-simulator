"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { msUntilNextSet } from "../lib/daily";
import { clockCountdown } from "../lib/emptyState";

/** A6: five gray card skeletons while today's plays load. */
export function CardSkeletons({ label }: { label: string }) {
  return (
    <div className="sg-skel" role="status" aria-live="polite">
      <span className="sg-sr">{label}</span>
      {Array.from({ length: 5 }, (_, i) => <div key={i} className="sg-skel-card" aria-hidden="true" />)}
    </div>
  );
}

/** A6: today's five already played on this device. One blue button, countdown to midnight ET. */
export function PlayedToday({ score, answered }: { score: string; answered: number }) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setMs(msUntilNextSet(new Date()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="sg-status sg-empty">
      <svg width="56" height="56" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
      <p>You played today&apos;s five: {score}/{answered}.</p>
      <p className="sg-empty-sub">Come back at midnight ET for the next five.</p>
      <div className="sg-clock" aria-label="Time until the next five">{ms == null ? "--:--:--" : clockCountdown(ms)}</div>
      <Link href="/practice/" className="sg-next sg-link">Practice five more</Link>
      <Link href="/daily/stats/" className="sg-keep">See your stats</Link>
    </div>
  );
}
