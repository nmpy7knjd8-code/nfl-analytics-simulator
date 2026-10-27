import { shareMetadata } from "../../lib/share";
import { FourthDownChecker } from "../../components/FourthDownChecker";

export const metadata = shareMetadata({
  title: "Check a 4th down · Fourth & Daily",
  description: "Set any 4th down and see go, kick or punt by chance to win, on the same engine as the Daily.",
  path: "/fourth-down/",
  card: "fourth-down",
  alt: "Go for it, kick, or punt? Win chance for each call. Data: nflverse",
});

export default function FourthDownPage() {
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
