import React, { type ReactNode } from "react";

/** Small white-on-accent glyphs for inset grouped list rows. */
export function IosGlyph({ name }: { name: "practice" | "stats" | "explore" | "about" | "teams" | "rivalry" | "playoffs" | "coaches" }) {
  const paths: Record<typeof name, ReactNode> = {
    practice: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" />
        <circle cx="12" cy="12" r="4.6" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      </svg>
    ),
    stats: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <rect x="4" y="3.5" width="16" height="17" rx="3" />
        <path d="M8 9h8M8 13h5" />
      </svg>
    ),
    explore: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" />
        <path d="M14.8 9.2 11 11.1 9.2 14.8 13 12.9 14.8 9.2Z" />
      </svg>
    ),
    about: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 11.2V17M12 7.6h.01" />
      </svg>
    ),
    teams: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3.5 4.8 6.2v5.2c0 4.4 3.1 7.6 7.2 9.1 4.1-1.5 7.2-4.7 7.2-9.1V6.2L12 3.5Z" />
      </svg>
    ),
    rivalry: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8h15M15 4l4 4-4 4" />
        <path d="M20 16H5M9 12l-4 4 4 4" />
      </svg>
    ),
    playoffs: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 6v5h4v7M19 6v5h-4v7" />
        <path d="M9 11h6" />
      </svg>
    ),
    coaches: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19c.6-3.4 3.2-5 6.5-5s5.9 1.6 6.5 5" />
      </svg>
    ),
  };
  return <span className="ios-list-icon">{paths[name]}</span>;
}

export function IosChevron() {
  return (
    <svg className="ios-chevron" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1.5 1.5 6.5 7l-5 5.5" />
    </svg>
  );
}
