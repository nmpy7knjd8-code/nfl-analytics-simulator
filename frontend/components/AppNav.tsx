"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", match: (p: string) => p === "/" || p.startsWith("/daily") && !p.startsWith("/daily/stats") },
  { href: "/practice/", label: "Practice", match: (p: string) => p.startsWith("/practice") },
  { href: "/games/", label: "Games", match: (p: string) => p.startsWith("/games") },
  { href: "/fourth-down/", label: "4th down", match: (p: string) => p.startsWith("/fourth-down") },
] as const;

export function TopBar() {
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
  const pathname = (usePathname() || "/").replace(/\/+$/, "") || "/";
  return (
    <nav className="app-nav app-nav-4" aria-label="Primary">
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
