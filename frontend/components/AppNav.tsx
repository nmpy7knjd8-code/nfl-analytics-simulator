"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  {
    href: "/games",
    label: "Games",
    match: (p: string) => p.startsWith("/games"),
  },
  {
    href: "/fourth-down",
    label: "4th down",
    match: (p: string) => p.startsWith("/fourth-down") || p.startsWith("/decide"),
  },
  {
    href: "/daily",
    label: "Quiz",
    match: (p: string) => p.startsWith("/daily") || p.startsWith("/quiz"),
  },
] as const;

export function AppNav() {
  const pathname = usePathname() || "/";

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
