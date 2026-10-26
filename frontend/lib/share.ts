import type { Metadata } from "next";

/** Public origin + path of the deployed site (GitHub Pages project site). */
export const SITE_URL = "https://nmpy7knjd8-code.github.io/nfl-analytics-simulator";

/** Card images are prebuilt at deploy time by scripts/og/make_cards.py into public/og/. */
export function cardUrl(card: string): string {
  return `${SITE_URL}/og/${card}.png`;
}

/**
 * Open Graph + X (Twitter) card tags for one page. `path` is the page's own route so
 * every shared card links back to the exact page/situation it shows.
 */
export function shareMetadata(opts: {
  title: string;
  description: string;
  path: string;
  card: string;
  alt: string;
}): Metadata {
  const url = `${SITE_URL}${opts.path}`;
  const image = { url: cardUrl(opts.card), width: 1200, height: 675, alt: opts.alt };
  return {
    title: opts.title,
    description: opts.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: "Fourth & Daily",
      title: opts.title,
      description: opts.description,
      url,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  };
}
