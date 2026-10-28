import type { Metadata } from "next";
import { notFound } from "next/navigation";
import colors from "../../../lib/teamColors.json";
import { teamNickname } from "../../../lib/teams";
import { TeamLogo } from "../../../components/TeamLogo";
import { Header, Trademark } from "../../../components/SimpleGame";
import { TeamRedzone } from "../../../components/TeamRedzone";
import { REDZONE } from "../../../lib/teamRedzone";
import Link from "next/link";
import { teamRivals, type Rival } from "../../../lib/rivalries";
import "../team.css";

type Props = { params: Promise<{ abbr: string }> };
const TEAMS = (colors as { teams: Record<string, { primary: string; secondary: string }> }).teams;

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(TEAMS).map((abbr) => ({ abbr }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { abbr } = await params;
  return { title: `${teamNickname(abbr)} red zone · Fourth & Daily` };
}

export default async function TeamPage({ params }: Props) {
  const { abbr } = await params;
  const c = TEAMS[abbr];
  if (!c || !REDZONE.teams.some((t) => t.team === abbr)) notFound();
  const [s0, s1] = REDZONE.seasons;
  const rivals = teamRivals(abbr);
  const top = rivals.slice(0, 6), rest = rivals.slice(6);
  const rivalRow = (r: Rival) => (
    <li key={r.key}>
      <Link href={`/rivalry/${r.key}/`} className="tm-rrow">
        <TeamLogo abbr={r.opp} size={28} />
        <span className="tm-rname">{teamNickname(r.opp)}</span>
        <span className="tm-rrec">{r.w}–{r.l}{r.t ? `–${r.t}` : ""} · {r.meetings} {r.meetings === 1 ? "game" : "games"}</span>
      </Link>
    </li>
  );
  return (
    <main id="main">
      <div className="sg-app tm" style={{ "--tm-c": c.primary } as React.CSSProperties}>
        <Header right={abbr} />
        <header className="tm-head">
          <TeamLogo abbr={abbr} size={44} />
          <h1 className="tm-h1">{teamNickname(abbr)}</h1>
        </header>
        <p className="tm-lede">How their offense did: red-zone touchdowns, yards per play and third downs.</p>
        <TeamRedzone abbr={abbr} />
        <section className="tm-rivals" aria-labelledby="tm-rivals-h">
          <h2 id="tm-rivals-h" className="tm-rh">Rivalries</h2>
          <p className="tm-rsub">Every meeting with each opponent, {s0}–{s1}, regular season and playoffs.</p>
          <ul className="tm-rlist">{top.map(rivalRow)}</ul>
          {rest.length ? (
            <details className="tm-rmore">
              <summary>All {rivals.length} opponents</summary>
              <ul className="tm-rlist">{rest.map(rivalRow)}</ul>
            </details>
          ) : null}
        </section>
        <p className="tm-note">
          A red-zone trip is a drive with a snap at the opponent 20 or closer. No points includes turnovers, turnover on downs,
          missed kicks and the clock running out. Yards per play counts runs and passes. Data: nflverse play-by-play, {s0}–{s1}, regular season.
        </p>
        <Trademark />
      </div>
    </main>
  );
}
