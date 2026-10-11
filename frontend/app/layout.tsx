import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Sans_3, Syne } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-syne",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-sans",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: "NFL Analytics Simulator",
  description:
    "Historical NFL play-by-play reconstruction. Phase 2 — replay only; no trained models yet.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${sourceSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        <div className="shell">
          <header className="topbar">
            <Link href="/" className="brand">
              NFL Analytics Simulator
            </Link>
            <nav className="nav" aria-label="Primary">
              <Link href="/games">Game Explorer</Link>
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
