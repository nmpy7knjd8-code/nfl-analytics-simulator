import Link from "next/link";
import { FIXTURE_GAMES, GAME_SOURCE_LINE } from "../../lib/fixtures";
import { gameCardHref } from "../../lib/gamePicker";

/** Game Story pages are built only for these ids (app/games/[gameId] generateStaticParams). */
const BUILT = new Set(FIXTURE_GAMES.items.map((g) => g.game_id));
import { Header, Trademark } from "../../components/SimpleGame";
import "./games-list.css";
import { TeamLogo } from "../../components/TeamLogo";
import { shareMetadata } from "../../lib/share";
import { fetchGames } from "../../lib/api";

export const metadata = shareMetadata({
  title: "Games · Fourth & Daily",
  description: "Replay NFL games play by play with the win-chance swing of every play.",
  path: "/games/",
  card: "games",
  alt: "NFL game stories: every play's win-chance swing. Data: nflverse",
});

export default async function GamesPage() {
  const result = await fetchGames(2023);
  const { data: games } = result;

  return (
    <main id="main">
      <div className="sg-app gl">
        <Header right="Games" />
        <h1 className="gl-title">Games</h1>
        <p className="gl-sub">2023 season · {games.total} games. Pick a matchup and see the plays that swung it.</p>
        <ul className="gl-list">
          {games.items.map((g) => (
            <li key={g.game_id}>
              <Link className="gl-row" href={gameCardHref(g.game_id, BUILT)}>
                <span className="gl-main">
                  <span className="gl-match">
                    <TeamLogo abbr={g.away_team_id} size={22} /> {g.away_team_id} <span className="gl-at">@</span> <TeamLogo abbr={g.home_team_id} size={22} /> {g.home_team_id}
                  </span>
                  <span className="gl-meta">Week {g.week} · {g.game_date}</span>
                </span>
                <span className="gl-score">{g.away_score ?? "—"}–{g.home_score ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="gl-src">{GAME_SOURCE_LINE}</p>
        <Trademark />
      </div>
    </main>
  );
}
