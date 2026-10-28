"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteMenuLinks } from "./SiteMenu";
import { CHECKER_ENABLED } from "../lib/features";

const ALL_TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/daily") && !p.startsWith("/daily/stats") },
  { href: "/practice/", label: "Practice", match: (p: string) => p.startsWith("/practice") },
  { href: "/games/", label: "Games", match: (p: string) => p.startsWith("/games") },
  { href: "/fourth-down/", label: "4th down", match: (p: string) => p.startsWith("/fourth-down") },
] as const;

// H6 (#80): the checker tab stays hidden while CHECKER_ENABLED is false.
const TABS = ALL_TABS.filter((t) => CHECKER_ENABLED || t.href !== "/fourth-down/");

/** Game-style routes have their own header and ☰ menu, so the old chrome is hidden there:
 * "/", "/daily", "/practice", "/endless", "/feed", "/kicks", "/about", "/daily/stats", "/era", "/calibration",
 * "/two-point", "/coaches" and anything under "/team/", "/coaches/", "/card/" or "/rivalry/". */
function useGameRoute(): boolean {
  // Lists live inside the function: lib/routeChrome.test.ts reads this body for each route.
  const GAME_EXACT = new Set(["/", "/daily", "/practice", "/endless", "/feed", "/kicks", "/about", "/daily/stats", "/era", "/calibration", "/two-point"]);
  const GAME_PREFIX = ["/team/", "/coaches/", "/card/", "/rivalry/"];
  const p = (usePathname() || "/").replace(/\/+$/, "") || "/";
  return GAME_EXACT.has(p) || p === "/coaches" || GAME_PREFIX.some((x) => p.startsWith(x));
}

export function TopBar() {
  if (useGameRoute()) return null;
  return (
    <header className="fd-top">
      <Link href="/" className="fd-brand">
        Fourth &amp; Daily
      </Link>
      <nav aria-label="Menu" className="fd-top-links">
        <SiteMenuLinks />
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
