import { shareMetadata } from "../../lib/share";
import Link from "next/link";
import { FourthDownChecker } from "../../components/FourthDownChecker";
import { CHECKER_ENABLED, CHECKER_PAUSED } from "../../lib/features";

const LIVE_METADATA = shareMetadata({
  title: "Check a 4th down · Fourth & Daily",
  description: "Set any 4th down and see go, kick or punt by chance to win, on the same engine as the Daily.",
  path: "/fourth-down/",
  card: "fourth-down",
  alt: "Go for it, kick, or punt? Win chance for each call. Data: nflverse",
});

// While paused: own title, the paused message as the share description, and noindex.
export const metadata = CHECKER_ENABLED
  ? LIVE_METADATA
  : {
      ...shareMetadata({ title: CHECKER_PAUSED.title, description: CHECKER_PAUSED.body, path: "/fourth-down/", card: "fourth-down", alt: CHECKER_PAUSED.title }),
      robots: { index: false, follow: true },
    };

export default function FourthDownPage() {
  if (!CHECKER_ENABLED) {
    // H6: no checker numbers render while the flag is off.
    return (
      <main className="fd-page" id="main">
        <section className="fd-panel empty-state" role="status">
          <p className="empty-state-label">{CHECKER_PAUSED.label}</p>
          <h1>{CHECKER_PAUSED.heading}</h1>
          <p>{CHECKER_PAUSED.body}</p>
          <Link className="fd-btn empty-state-cta" href={CHECKER_PAUSED.cta.href}>{CHECKER_PAUSED.cta.label}</Link>
        </section>
      </main>
    );
  }
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Check a 4th down</h1>
        <p className="fd-sub">Set the situation. Same engine and rules as the Daily.</p>
      </header>
      <FourthDownChecker />
    </main>
  );
}
