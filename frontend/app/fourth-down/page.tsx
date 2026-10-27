import Link from "next/link";
import { CHECKER_ENABLED, CHECKER_PAUSED } from "../../lib/features";
import { shareMetadata } from "../../lib/share";
import { ExampleBanner } from "../../components/ExampleBanner";
import { FourthDownLab } from "../../components/FourthDownLab";
import { TruthChip } from "../../components/TruthChip";
import { FIXTURE_BANNER } from "../../lib/fixtures";

export const metadata = shareMetadata({
  title: "4th-down checker · Fourth & Daily",
  description:
    "Compare go for it, kick, or punt in plain English — chance of winning, not a stats dump.",
  path: "/fourth-down/",
  card: "fourth-down",
  alt: "Go for it, kick, or punt? Win chance for each call. Data: nflverse",
});

export default function DecidePage() {
  if (!CHECKER_ENABLED) {
    // H6: no checker numbers render while the flag is off (Data & Models: late-Q4 goal-line values still off).
    return (
      <main className="decide-page page" id="main">
        <section className="empty-state" role="status">
          <h1>{CHECKER_PAUSED.title}</h1>
          <p>{CHECKER_PAUSED.body}</p>
          <Link className="btn btn-primary" href={CHECKER_PAUSED.cta.href}>{CHECKER_PAUSED.cta.label}</Link>
        </section>
      </main>
    );
  }
  return (
    <main className="decide-page page" id="main">
      <header className="section-head">
        <div className="overline">
          <TruthChip kind="simulated" />
          <span className="muted">Example</span>
        </div>
        <h1>Go, kick, or punt?</h1>
        <p>See the call, then the short why — in plain English.</p>
      </header>

      <ExampleBanner message={FIXTURE_BANNER} />

      <FourthDownLab />
    </main>
  );
}
