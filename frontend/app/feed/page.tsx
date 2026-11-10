import { PlayFeedC6 } from "../../components/PlayFeedC6";
import { gameSeasons } from "../../lib/seasons";

export const metadata = { title: "Play feed · Fourth & Daily" };

export default function FeedPage() {
  return (
    <main id="main">
      <PlayFeedC6 seasons={gameSeasons("desc")} />
    </main>
  );
}
