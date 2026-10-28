/**
 * Feature flags for the static site.
 *
 * CHECKER_ENABLED: the 4th-down checker (/fourth-down/). On since H6 was fixed
 * (grid win chances had run 8-10 points high). Flip to false to bring back the nav tab,
 * the 404 link and the checker page — nothing else needs to change.
 */
export const CHECKER_ENABLED = true;

/** Copy for the page while the checker is off. */
export const CHECKER_PAUSED = {
  title: "Checker is being recalibrated, back soon",
  body: "We're re-checking the win chances behind the 4th-down checker. Until then, play Fourth & Daily: real fourth downs, new every day.",
  cta: { href: "/", label: "Play Fourth & Daily" },
} as const;
