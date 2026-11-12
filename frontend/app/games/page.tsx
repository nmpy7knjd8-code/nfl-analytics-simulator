import { FIXTURE_GAMES, GAME_SOURCE_LINE } from "../../lib/fixtures";
import { Header, Trademark } from "../../components/SimpleGame";
import { shareMetadata } from "../../lib/share";
import { GamesIndex } from "./GamesIndex";
import "./games-ios.css";

export const metadata = shareMetadata({
  title: "Games · Fourth & Daily",
  description: "Replay NFL games play by play with the win-chance swing of every play.",
  path: "/games/",
  card: "games",
  alt: "NFL game stories: every play's win-chance swing. Data: nflverse",
});

export default function GamesPage() {
  const built = FIXTURE_GAMES.items.map((g) => g.game_id);
  return (
    <main id="main">
      <div className="sg-app ios-games">
        <Header right="Games" />
        <h1 className="ios-large-title">Games</h1>
        <GamesIndex built={built} />
        <p className="ios-games-src">{GAME_SOURCE_LINE}</p>
        <Trademark />
      </div>
    </main>
  );
}
