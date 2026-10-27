/**
 * Feature flags for the static site.
 *
 * CHECKER_ENABLED: the 4th-down checker (/fourth-down/). Off while Data & Models fix H6
 * (grid win chances ran 8-10 points high). Flip to true to bring back the nav tab,
 * the 404 link and the checker page — nothing else needs to change.
 */
export const CHECKER_ENABLED = false;

/** Copy and metadata for the page while the checker is off (recheck 2039 L1/L2). */
export const CHECKER_PAUSED = {
  title: "4th-down checker, back soon",
  label: "4th-down checker",
  heading: "Back soon",
  body: "We're re-checking the win chances behind the 4th-down checker. Until then, try today's five real fourth downs.",
  cta: { href: "/daily/", label: "Play today's five" },
} as const;
