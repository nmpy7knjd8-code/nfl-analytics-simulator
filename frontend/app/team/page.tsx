import type { Metadata } from "next";
import Link from "next/link";
import colors from "../../lib/teamColors.json";
import { teamNickname } from "../../lib/teams";
import { TeamLogo } from "../../components/TeamLogo";
import { Header, Trademark } from "../../components/SimpleGame";
import "../section-index.css";

export const metadata: Metadata = { title: "Teams · Fourth & Daily" };

const ABBRS = Object.keys((colors as { teams: Record<string, unknown> }).teams).sort((a, b) => teamNickname(a).localeCompare(teamNickname(b)));

export default function TeamsIndex() {
  return (
    <main id="main">
      <div className="sg-app ix">
        <Header right="Teams" />
        <h1 className="ix-title">Teams</h1>
        <p className="ix-sub">All {ABBRS.length} teams: red-zone touchdowns, close-game stats and rivalries, 2019–2025.</p>
        <ul className="ix-grid">
          {ABBRS.map((a) => (
            <li key={a}>
              <Link className="ix-card" href={`/team/${a}/`}>
                <TeamLogo abbr={a} size={28} />
                <b>{teamNickname(a)}</b>
              </Link>
            </li>
          ))}
        </ul>
        <p className="ix-src">Data: nflverse.</p>
        <Trademark />
      </div>
    </main>
  );
}
