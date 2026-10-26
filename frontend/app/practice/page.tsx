import { DailyGame } from "../../components/DailyGame";

export const metadata = { title: "Practice · Fourth & Daily" };

export default function PracticePage() {
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Practice</h1>
        <p className="fd-sub">Five random real 4th downs. Doesn&apos;t touch your streak.</p>
      </header>
      <DailyGame mode="practice" />
    </main>
  );
}
