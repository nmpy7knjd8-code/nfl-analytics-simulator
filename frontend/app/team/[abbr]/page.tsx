import type { Metadata } from "next";
import { notFound } from "next/navigation";
import colors from "../../../lib/teamColors.json";
import { teamNickname } from "../../../lib/teams";
import { TeamLogo } from "../../../components/TeamLogo";
import { Header, Trademark } from "../../../components/SimpleGame";
import { TeamRedzone } from "../../../components/TeamRedzone";
import { REDZONE } from "../../../lib/teamRedzone";
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
  return (
    <main id="main">
      <div className="sg-app tm" style={{ "--tm-c": c.primary } as React.CSSProperties}>
        <Header right={abbr} />
        <header className="tm-head">
          <TeamLogo abbr={abbr} size={44} />
          <h1 className="tm-h1">{teamNickname(abbr)}</h1>
        </header>
        <p className="tm-lede">How often their trips inside the opponent 20 ended in a touchdown.</p>
        <TeamRedzone abbr={abbr} />
        <p className="tm-note">
          A red-zone trip is a drive with a snap at the opponent 20 or closer. No points includes turnovers, turnover on downs,
          missed kicks and the clock running out. Data: nflverse play-by-play, {s0}–{s1}, regular season.
        </p>
        <Trademark />
      </div>
    </main>
  );
}
