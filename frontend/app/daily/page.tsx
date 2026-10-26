import { DailyGame } from "../../components/DailyGame";
import { TodayHeader } from "../../components/TodayHeader";
import { shareMetadata } from "../../lib/share";

export const metadata = shareMetadata({
  title: "Today's 5 · Fourth & Daily",
  description: "Five real NFL 4th downs a day. Go, kick or punt? See what the coach did and what the numbers say.",
  path: "/daily/",
  card: "daily",
  alt: "Today's fourth downs: go, kick, or punt? Data: nflverse",
});

export default function DailyPage() {
  return (
    <main className="fd-page" id="main">
      <TodayHeader />
      <DailyGame mode="daily" />
    </main>
  );
}
