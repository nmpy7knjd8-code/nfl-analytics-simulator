import type { Metadata, Viewport } from "next";
import { AppNav, TopBar } from "../components/AppNav";
import { IosTabBar } from "../components/IosTabBar";
import "./tokens.css";
import "./ios-shell.css";
import "./globals.css";
import "./simple-game.css";
import { shareMetadata } from "../lib/share";

// Syne, Source Sans 3, and IBM Plex Mono are no longer loaded. Hierarchy
// comes from the iOS system font stack in tokens.css (weight and size).
// Font files remain under app/fonts/ but are unused.

export const metadata: Metadata = shareMetadata({
  title: "Fourth & Daily — five real 4th downs a day",
  description: "Every day, five real NFL 4th downs. Go, kick or punt? See what the coach did and what the numbers say.",
  path: "/",
  card: "home",
  alt: "Fourth & Daily — real NFL fourth downs, would you go for it? Data: nflverse",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <a className="sr-only" href="#main">
            Skip to content
          </a>
          <TopBar />
          <div className="app-stage">{children}</div>
          <AppNav />
          <IosTabBar />
        </div>
      </body>
    </html>
  );
}
