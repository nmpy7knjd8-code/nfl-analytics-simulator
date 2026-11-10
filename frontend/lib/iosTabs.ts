/** Single source of truth for the iOS tab bar.
 *
 * Head Grokka final set (Nov 10): Today / Feed / Games / More.
 * Practice lives on the Today hub only, not on the bar or in More.
 *
 * Swap to the 5-tab candidate by changing the IOS_TABS assignment below.
 * CSS uses --ios-tab-count and minmax(0, 1fr) so five 10–11px labels fit at 360px.
 */
export type IosTabIcon = "today" | "feed" | "games" | "more" | "practice" | "stats" | "explore";

export type IosTab = {
  href: string;
  label: string;
  icon: IosTabIcon;
  match: (pathname: string) => boolean;
};

export function normPath(pathname: string): string {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

const isToday = (p: string) => {
  const x = normPath(p);
  return x === "/" || x === "/daily" || x === "/practice";
};

const isFeed = (p: string) => normPath(p).startsWith("/feed");
const isGames = (p: string) => normPath(p).startsWith("/games");

const MORE_EXACT = new Set([
  "/more", "/explore", "/about", "/daily/stats", "/endless",
  "/kicks", "/era", "/calibration", "/outcomes", "/heatmap", "/match-chart",
  "/wheres-the-ball", "/fake-punt", "/two-point", "/comebacks", "/on-this-day",
  "/story", "/swing", "/first-down", "/fourth-down",
  "/team", "/rivalry", "/playoffs", "/coaches",
]);

const isMore = (p: string) => {
  const x = normPath(p);
  return MORE_EXACT.has(x)
    || x.startsWith("/team/")
    || x.startsWith("/rivalry/")
    || x.startsWith("/playoffs/")
    || x.startsWith("/coaches/");
};

/** Final 4-tab set. */
export const IOS_TABS_4: IosTab[] = [
  { href: "/", label: "Today", icon: "today", match: isToday },
  { href: "/feed/", label: "Feed", icon: "feed", match: isFeed },
  { href: "/games/", label: "Games", icon: "games", match: isGames },
  { href: "/more/", label: "More", icon: "more", match: isMore },
];

/** Candidate 5-tab set from research. One-line swap: `export const IOS_TABS = IOS_TABS_5`. */
export const IOS_TABS_5: IosTab[] = [
  { href: "/", label: "Today", icon: "today", match: isToday },
  { href: "/feed/", label: "Feed", icon: "feed", match: isFeed },
  { href: "/games/", label: "Games", icon: "games", match: isGames },
  { href: "/daily/stats/", label: "Stats", icon: "stats", match: (p) => normPath(p) === "/daily/stats" },
  { href: "/explore/", label: "Explore", icon: "explore", match: isMore },
];

export const IOS_TABS: IosTab[] = IOS_TABS_4;
