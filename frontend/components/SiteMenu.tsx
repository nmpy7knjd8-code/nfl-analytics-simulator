"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The one site menu, used by the ☰ menu (SimpleGame Header) and the top bar on
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
      {/* Explore: only routes with an index page on main (/team, /rivalry, /playoffs are per-slug only, reached from Games). Includes /fake-punt/ and /two-point/. */}
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
      <span className="sg-menu-group" aria-hidden="true" />
      <Link href="/about/">About</Link>
    </>
  );
}

/**
 * The ☰ button + .sg-menu-list dropdown. One menu pattern sitewide: SimpleGame
 * Header and the older-page TopBar both render this. Escape and outside clicks
 * close it; Escape returns focus to the button.
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
      <button ref={btn} type="button" className="sg-menu" aria-label="Menu" aria-expanded={open} aria-controls="site-menu-list" onClick={() => setOpen((o) => !o)}>☰</button>
      {open ? (
        <nav id="site-menu-list" className="sg-menu-list" aria-label="Menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) setOpen(false); }}>
          <SiteMenuLinks />
        </nav>
      ) : null}
    </div>
  );
}
