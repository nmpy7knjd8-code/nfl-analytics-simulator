"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHECKER_ENABLED } from "../lib/features";

const ALL_TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/daily") && !p.startsWith("/daily/stats") },
  { href: "/practice/", label: "Practice", match: (p: string) => p.startsWith("/practice") },
  { href: "/games/", label: "Games", match: (p: string) => p.startsWith("/games") },
  { href: "/fourth-down/", label: "4th down", match: (p: string) => p.startsWith("/fourth-down") },
] as const;

// H6 (#80): the checker tab stays hidden while CHECKER_ENABLED is false.
const TABS = ALL_TABS.filter((t) => CHECKER_ENABLED || t.href !== "/fourth-down/");

/** The simple game ("/", "/daily", "/practice", "/endless") has its own header and ☰ menu, so the old chrome is hidden there. */
function useGameRoute(): boolean {
  const p = (usePathname() || "/").replace(/\/+$/, "") || "/";
  return p === "/" || p === "/daily" || p === "/practice" || p === "/endless" || p === "/feed" || p.startsWith("/team/");
}

export function TopBar() {
  if (useGameRoute()) return null;
  return (
    <header className="fd-top">
      <Link href="/" className="fd-brand">
        Fourth &amp; Daily
      </Link>
      <nav aria-label="More" className="fd-top-links">
        <Link href="/daily/stats/">Stats</Link>
        <Link href="/about/">About</Link>
      </nav>
    </header>
  );
}

export function AppNav() {
  const game = useGameRoute();
  const pathname = (usePathname() || "/").replace(/\/+$/, "") || "/";
  if (game) return null;
  return (
    <nav className={`app-nav${TABS.length === 4 ? " app-nav-4" : ""}`} aria-label="Primary">
      {TABS.map((tab) => {
        const current = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`app-nav-item${current ? " is-current" : ""}`}
            aria-current={current ? "page" : undefined}
          >
            <span className="app-nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
