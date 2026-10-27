import type { Metadata } from "next";
import Link from "next/link";
import { CHECKER_ENABLED } from "../lib/features";

// Branded 404 (QA2 L4). The Pages build (scripts/pages/assemble.py) injects a small
// script into the exported 404.html that forwards old /demo/, /quiz/ and /decide/ links.
export const metadata: Metadata = {
  title: "Page not found · NFL Analytics Simulator",
  description: "That page doesn't exist. Head home, play today's fourth-down quiz, or open a game.",
  robots: { index: false },
};

const ALL_LINKS = [
  { href: "/", label: "Home", note: "Start here" },
  { href: "/daily", label: "Today's quiz", note: "Go, kick, or punt?" },
  { href: "/fourth-down", label: "4th down", note: "Real fourth downs, side by side" },
  { href: "/games", label: "Games", note: "Replay real games play by play" },
] as const;

const LINKS = ALL_LINKS.filter((l) => CHECKER_ENABLED || l.href !== "/fourth-down");

export default function NotFound() {
  return (
    <section className="not-found page" id="main" aria-labelledby="nf-title">
      <p className="not-found-code">404</p>
      <h1 id="nf-title" className="not-found-title">
        That page isn&apos;t on the field.
      </h1>
      <p className="not-found-copy">
        The link may be old or mistyped. Pick up from one of these:
      </p>
      <ul className="not-found-links">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href}>
              <span className="not-found-label">{l.label}</span>
              <span className="not-found-note">{l.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
