import { DailyOrBonus } from "../../components/DailyOrBonus";
import "../fake-punt/fake-punt.css";
import "./bonus.css";
import "../ios-game.css";
import { shareMetadata } from "../../lib/share";

export const metadata = shareMetadata({
  title: "Fourth & Daily",
  description: "Real NFL 4th downs, every day. Go, kick or punt? See what the coach did and what the numbers say.",
  path: "/daily/",
  card: "daily",
  alt: "Today's fourth downs: go, kick, or punt? Data: nflverse",
});

export default function DailyPage() {
  return (
    <main id="main">
      <DailyOrBonus />
    </main>
  );
}
