import { DailyGame } from "../../components/DailyGame";
import { TodayHeader } from "../../components/TodayHeader";

export const metadata = { title: "Today's 5 · Fourth & Daily" };

export default function DailyPage() {
  return (
    <main className="fd-page" id="main">
      <TodayHeader />
      <DailyGame mode="daily" />
    </main>
  );
}
