import Link from "next/link";
import { readGameFile } from "../../lib/gameFiles";
import { longDate, STORY_GAME_IDS, winner } from "../../lib/gameStory";

export const metadata = { title: "Games · Fourth & Daily" };

export default function GamesPage() {
  const games = STORY_GAME_IDS.map((id) => readGameFile(id).game);
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Games</h1>
        <p className="fd-sub">Every play, the win chance after it, and the 4th-down calls. Real nflverse data.</p>
      </header>
      <ul className="gs-list">
        {games.map((g) => {
          const w = winner(g);
          return (
            <li key={g.id}>
              <Link className="gs-row" href={`/games/${g.id}/`}>
                <span className="gs-row-teams">
                  <span className={w === g.away ? "is-win" : undefined}>{g.away} {g.away_score}</span>
                  {" @ "}
                  <span className={w === g.home ? "is-win" : undefined}>{g.home} {g.home_score}</span>
                  {g.overtime ? " (OT)" : ""}
                </span>
                <span className="fd-muted">{g.season} Week {g.week} · {longDate(g.date)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="fd-muted">More seasons are coming as game files are published.</p>
    </main>
  );
}
