import type { Metadata } from "next";
import Link from "next/link";
import { teamNickname } from "../../lib/teams";
import { TeamLogo } from "../../components/TeamLogo";
import { Header, Trademark } from "../../components/SimpleGame";
import { SEASONS, bracket } from "../../lib/playoffs";
import { seasonEnds } from "../../lib/seasons";
import "../section-index.css";

export const metadata: Metadata = { title: "Playoffs · Fourth & Daily" };

export default function PlayoffsIndex() {
  const rows = [...SEASONS].reverse().map((s) => bracket(s));
  const ends = seasonEnds(SEASONS);
  return (
    <main id="main">
      <div className="sg-app ix">
        <Header right="Playoffs" />
        <h1 className="ix-title">Playoffs</h1>
        <p className="ix-sub">Every playoff bracket, {ends ? <>{ends[0]}–{ends[1]}</> : ""} seasons.</p>
        <ul className="ix-list">
          {rows.map((b) => (
            <li key={b.season}>
              <Link className="ix-card" href={`/playoffs/${b.season}/`}>
                <TeamLogo abbr={b.champion} size={28} />
                <span className="ix-grow"><b>{b.season} season</b><small>Super Bowl {b.sbNumber} · {teamNickname(b.champion)} won</small></span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="ix-src">Data: nflverse schedules.</p>
        <Trademark />
      </div>
    </main>
  );
}
