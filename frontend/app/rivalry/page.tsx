import type { Metadata } from "next";
import Link from "next/link";
import colors from "../../lib/teamColors.json";
import { teamNickname } from "../../lib/teams";
import { TeamLogo } from "../../components/TeamLogo";
import { Header, Trademark } from "../../components/SimpleGame";
import { SEASONS, allPairs, teamRivals } from "../../lib/rivalries";
import { seasonCoverageText } from "../../lib/seasons";
import "../section-index.css";

export const metadata: Metadata = { title: "Rivalries · Fourth & Daily" };

const ABBRS = Object.keys((colors as { teams: Record<string, unknown> }).teams).sort((a, b) => teamNickname(a).localeCompare(teamNickname(b)));
const rec = (w: number, l: number, t: number) => `${w}–${l}${t ? `–${t}` : ""}`;

export default function RivalriesIndex() {
  return (
    <main id="main">
      <div className="sg-app ix">
        <Header right="Rivalries" />
        <h1 className="ix-title">Rivalries</h1>
        <p className="ix-sub">{allPairs().length} matchups, {seasonCoverageText(SEASONS)}. Open a team to see every opponent it played, most meetings first.</p>
        <div className="ix-list">
          {ABBRS.map((a) => {
            const rivals = teamRivals(a);
            return (
              <details key={a} className="ix-team">
                <summary><TeamLogo abbr={a} size={28} /> {teamNickname(a)}</summary>
                <ul>
                  {rivals.map((r) => (
                    <li key={r.key}>
                      <Link href={`/rivalry/${r.key}/`}>
                        <span>vs {teamNickname(r.opp)}</span>
                        <small>{r.meetings} {r.meetings === 1 ? "game" : "games"} · {rec(r.w, r.l, r.t)}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
        <p className="ix-src">Regular season and playoffs. Data: nflverse.</p>
        <Trademark />
      </div>
    </main>
  );
}
