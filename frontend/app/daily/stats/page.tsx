import { StatsView } from "../../../components/StatsView";

export const metadata = { title: "Your stats · Fourth & Daily" };

export default function StatsPage() {
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Your stats</h1>
      </header>
      <StatsView />
    </main>
  );
}
