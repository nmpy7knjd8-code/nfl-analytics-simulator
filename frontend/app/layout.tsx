import type { Metadata, Viewport } from "next";
import { AppNav, TopBar } from "../components/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fourth & Daily — five real 4th downs a day",
  description: "Every day, five real NFL 4th downs. Go, kick or punt? See what the coach did and what the numbers say.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
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
        </div>
      </body>
    </html>
  );
}
