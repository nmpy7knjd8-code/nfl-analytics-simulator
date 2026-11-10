"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IOS_TABS, type IosTabIcon } from "../lib/iosTabs";

const ICONS: Record<IosTabIcon, ReactNode> = {
  today: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <path d="M12 3.2 3.6 10.2c-.3.24-.4.4-.4.7V20a1.5 1.5 0 0 0 1.5 1.5H9.2v-6.2h5.6V21.5h4.5A1.5 1.5 0 0 0 21 20v-9.1c0-.3-.1-.46-.4-.7L12 3.2Z" />
    </svg>
  ),
  feed: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M6.5 7.25h11" />
      <path d="M6.5 12h11" />
      <path d="M6.5 16.75h8" />
      <circle cx="4.1" cy="7.25" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="4.1" cy="12" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="4.1" cy="16.75" r="0.95" fill="currentColor" stroke="none" />
    </svg>
  ),
  games: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
      <path d="M8 5V3.8M16 5V3.8M3.5 9.5h17" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="12" r="1.7" />
      <circle cx="12" cy="12" r="1.7" />
      <circle cx="18" cy="12" r="1.7" />
    </svg>
  ),
  practice: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M12 7.5v5l3.2 1.8" />
    </svg>
  ),
  stats: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  ),
  explore: (
    <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="8.2" />
      <path d="M14.8 9.2 11 11.1 9.2 14.8 13 12.9 14.8 9.2Z" />
    </svg>
  ),
};

export function IosTabBar() {
  const pathname = usePathname() || "/";
  return (
    <nav
      className="ios-tabbar"
      aria-label="Primary"
      style={{ ["--ios-tab-count" as string]: String(IOS_TABS.length) }}
    >
      {IOS_TABS.map((tab) => {
        const current = tab.match(pathname);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={current ? "ios-tab is-current" : "ios-tab"}
            aria-current={current ? "page" : undefined}
          >
            <span className="ios-tab-icon" aria-hidden="true">{ICONS[tab.icon]}</span>
            <span className="ios-tab-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
