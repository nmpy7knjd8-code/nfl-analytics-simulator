import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppNav } from "../components/AppNav";
import "./globals.css";
import { shareMetadata } from "../lib/share";

// Self-hosted (app/fonts, OFL) so builds never fetch from Google Fonts.
const syne = localFont({
  src: "./fonts/syne-latin-wght-normal.woff2",
  weight: "400 800",
  variable: "--font-syne",
  display: "swap",
});

const sourceSans = localFont({
  src: "./fonts/source-sans-3-latin-wght-normal.woff2",
  weight: "200 900",
  variable: "--font-source-sans",
  display: "swap",
});

const ibmPlexMono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600" },
  ],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = shareMetadata({
  title: "NFL Analytics Simulator",
  description:
    "See real NFL games play by play, and explore tough calls like fourth-and-short — in plain English.",
  path: "/",
  card: "home",
  alt: "Fourth & Daily — real NFL fourth downs, would you go for it? Data: nflverse",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${sourceSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        <div className="app-shell">
          <a className="sr-only" href="#main">
            Skip to content
          </a>
          <div className="app-stage">{children}</div>
          <AppNav />
        </div>
      </body>
    </html>
  );
}
