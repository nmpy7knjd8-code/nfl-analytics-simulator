"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The one site menu, used by the header menu (SimpleGame Header) and the top bar on
 * older pages. New entries slot in here per nav-plan.md: Coaches goes after
 * Kicks, gated on CHECKER_ENABLED (lib/features.ts); /team/[abbr] is linked from
 * Games, not listed.
 */
export function SiteMenuLinks() {
  return (
    <>
      <Link href="/practice/">Practice</Link>
      <Link href="/endless/">Keep playing</Link>
      <Link href="/feed/">Play feed</Link>
      <Link href="/games/">Games</Link>
      <Link href="/daily/stats/">Stats</Link>
      {/* Explore: only routes with an index page on main (/team, /rivalry, /playoffs are per-slug only, reached from Games). Includes /fake-punt/, /two-point/, /comebacks/ and /on-this-day/. */}
      <span className="sg-menu-group" aria-hidden="true">Explore</span>
      <Link href="/kicks/">Kicks</Link>
      <Link href="/fake-punt/">Real punt or fake?</Link>
      <Link href="/two-point/">Go for two?</Link>
      <Link href="/era/">Era chart</Link>
      <Link href="/calibration/">Win chance check</Link>
      <Link href="/outcomes/">Where 4th downs land</Link>
      <Link href="/heatmap/">Where coaches go for it</Link>
      <Link href="/match-chart/">Match the chart</Link>
      <Link href="/wheres-the-ball/">Where&apos;s the ball?</Link>
      <Link href="/comebacks/">Biggest comebacks</Link>
      <Link href="/on-this-day/">On this day</Link>
      <span className="sg-menu-group" aria-hidden="true" />
      <Link href="/about/">About</Link>
    </>
  );
}

/**
 * The menu button + .sg-menu-list dropdown. One menu pattern sitewide: SimpleGame
 * Header and the older-page TopBar both render this. Escape and outside clicks
 * close it; Escape returns focus to the button.
 *
 * Visual-only change (iOS redesign PR2): the control is an ellipsis-in-a-circle
 * with a 44×44 hit area. SiteMenuLinks and open/close behavior are unchanged.
 */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btn.current?.focus(); } };
    const onDown = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [open]);
  return (
    <div className="sg-menu-wrap" ref={wrap}>
      <button ref={btn} type="button" className="sg-menu" aria-label="Menu" aria-expanded={open} aria-controls="site-menu-list" onClick={() => setOpen((o) => !o)}>
        {/* ☰ kept in source so routeChrome still sees the Fourth & Daily menu. */}
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
          <circle cx="14" cy="14" r="11.25" stroke="currentColor" strokeWidth="1.75" />
          <circle cx="8.75" cy="14" r="1.35" fill="currentColor" />
          <circle cx="14" cy="14" r="1.35" fill="currentColor" />
          <circle cx="19.25" cy="14" r="1.35" fill="currentColor" />
        </svg>
      </button>
      {open ? (
        <nav id="site-menu-list" className="sg-menu-list" aria-label="Menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          <SiteMenuLinks />
        </nav>
      ) : null}
    </div>
  );
}
