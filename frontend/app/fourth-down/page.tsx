import { shareMetadata } from "../../lib/share";
import Link from "next/link";
import { FourthDownChecker } from "../../components/FourthDownChecker";
import { CHECKER_ENABLED, CHECKER_PAUSED } from "../../lib/features";

export const metadata = shareMetadata({
  title: "Check a 4th down · Fourth & Daily",
  description: "Set any 4th down and see go, kick or punt by chance to win, on the same engine as the Daily.",
  path: "/fourth-down/",
  card: "fourth-down",
  alt: "Go for it, kick, or punt? Win chance for each call. Data: nflverse",
});

export default function FourthDownPage() {
  if (!CHECKER_ENABLED) {
    // H6: no checker numbers render while the flag is off.
    return (
      <main className="fd-page" id="main">
        <section className="fd-panel" role="status">
          <h1>{CHECKER_PAUSED.title}</h1>
          <p>{CHECKER_PAUSED.body}</p>
          <Link className="fd-btn fd-btn-primary" href={CHECKER_PAUSED.cta.href}>{CHECKER_PAUSED.cta.label}</Link>
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
