import { CalibrationChart } from "../../components/CalibrationChart";

export const metadata = { title: "Is 5% really 5%? · Fourth & Daily" };

export default function CalibrationPage() {
  return (
    <main className="fd-page" id="main">
      <h1 className="kb-h1">Is 5% really 5%?</h1>
      <p className="kb-lede">When nflverse&apos;s model says a team has a 5% chance to win, do they win about 5% of the time? Tap a dot.</p>
      <CalibrationChart />
    </main>
  );
}
