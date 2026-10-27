/**
 * Feature flags for the static site.
 *
 * CHECKER_ENABLED: the 4th-down checker (/fourth-down/). Off while Data & Models fix H6
 * (grid win chances ran 8-10 points high). Flip to true to bring back the nav tab,
 * the 404 link and the checker page — nothing else needs to change.
 */
export const CHECKER_ENABLED = false;

/** Copy for the page while the checker is off. */
export const CHECKER_PAUSED = {
  title: "Checker is being recalibrated, back soon",
  body: "We're re-checking the win chances behind the 4th-down checker. Until then, try today's five real fourth downs.",
  cta: { href: "/daily/", label: "Play today's five" },
} as const;
