import Link from "next/link";
import { CHECKER_ENABLED, CHECKER_PAUSED } from "../../lib/features";
import { shareMetadata } from "../../lib/share";
import { FourthDownChecker } from "../../components/FourthDownChecker";
import { Header, Trademark } from "../../components/SimpleGame";
import "./fourth-down.css";

export const metadata = shareMetadata({
  title: "4th-down checker · Fourth & Daily",
  description: "Go for it, kick, or punt? See the chance to win for each call, in plain English.",
  path: "/fourth-down/",
  card: "fourth-down",
  alt: "Go for it, kick, or punt? Win chance for each call. Data: nflverse",
});

export default function DecidePage() {
  if (!CHECKER_ENABLED) {
    // H6: no checker numbers render while the flag is off.
    return (
      <main id="main">
        <div className="sg-app fd4">
          <Header right="4th down" />
          <div className="sg-status" role="status">
            <p>{CHECKER_PAUSED.title}</p>
            <p className="fd4-sub">{CHECKER_PAUSED.body}</p>
            <Link className="sg-next fd4-cta" href={CHECKER_PAUSED.cta.href}>{CHECKER_PAUSED.cta.label}</Link>
          </div>
          <Trademark />
        </div>
      </main>
    );
  }
  return (
    <main id="main">
      <FourthDownChecker />
    </main>
  );
}
