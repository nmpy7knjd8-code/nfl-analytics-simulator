import Link from "next/link";
import { DailyGame } from "../components/DailyGame";
import { TodayHeader } from "../components/TodayHeader";
import { YesterdayCall } from "../components/YesterdayCall";

export default function HomePage() {
  return (
    <main className="fd-page" id="main">
      <TodayHeader />
      <DailyGame mode="daily" />
      <YesterdayCall />
      <section className="fd-panel">
        <h2>Bonus: pass or run?</h2>
        <p>
          Five real 1st-and-10 plays each week. Guess the coach&apos;s call. <Link href="/first-down/">Play this week&apos;s round →</Link>
        </p>
      </section>
      <section className="fd-panel">
        <h2>Real games, play by play</h2>
        <p>
          See how each game&apos;s win chance moved. <Link href="/games/">Browse games →</Link>
        </p>
      </section>
    </main>
  );
}
