import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Source_Sans_3, Syne } from "next/font/google";
import { AppNav } from "../components/AppNav";
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
    "See real NFL games play by play, and explore tough calls like fourth-and-short — in plain English.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1d4ed8",
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
