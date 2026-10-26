import { DailyGame } from "../../../components/DailyGame";

export const metadata = { title: "Yesterday's 5 · Fourth & Daily" };

export default function YesterdayPage() {
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Yesterday&apos;s 5</h1>
        <p className="fd-sub">Practice with yesterday&apos;s set. Doesn&apos;t count for your streak.</p>
      </header>
      <DailyGame mode="yesterday" />
    </main>
  );
}
