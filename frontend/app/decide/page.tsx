import { ExampleBanner } from "../../components/ExampleBanner";
import { FourthDownLab } from "../../components/FourthDownLab";
import { TruthChip } from "../../components/TruthChip";
import { FIXTURE_BANNER } from "../../lib/fixtures";

export const metadata = {
  title: "4th & short — NFL Analytics Simulator",
  description:
    "Compare go for it, kick, or punt in plain English — chance of winning, not a stats dump.",
};

export default function DecidePage() {
  return (
    <main className="decide-page page" id="main">
      <header className="section-head">
        <div className="overline">
          <TruthChip kind="simulated" />
          <span className="muted">Example</span>
        </div>
        <h1>Go, kick, or punt?</h1>
        <p>Tap a choice. See who keeps a better chance of winning.</p>
      </header>

      <ExampleBanner message={FIXTURE_BANNER} />

      <FourthDownLab />
    </main>
  );
}
