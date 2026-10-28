import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachBlock, EnginePaused, GamePage, SeasonPicker } from "../../../../components/CoachesView";
import { TeamLogo } from "../../../../components/TeamLogo";
import { SEASONS, coachHref, readSeason, seasonHref } from "../../../../lib/coaches";
import { CHECKER_ENABLED } from "../../../../lib/features";
import { teamNickname } from "../../../../lib/teams";
import "../../coaches.css";

type Props = { params: Promise<{ slug: string; season: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SEASONS.flatMap((s) => [...new Set(readSeason(s).coaches.map((c) => c.team))].map((team) => ({ slug: team, season: String(s) })));
}

export async function generateMetadata({ params }: Props) {
  const { slug, season } = await params;
  return { title: `${teamNickname(slug)} coach ${season} · Fourth & Daily` };
}

export default async function CoachDetail({ params }: Props) {
  const { slug: team, season: s } = await params;
  const season = Number(s);
  if (!(SEASONS as readonly number[]).includes(season)) notFound();
  const data = readSeason(season);
  const coaches = data.coaches.filter((c) => c.team === team);
  if (!coaches.length) notFound();
  if (!CHECKER_ENABLED) return <EnginePaused />;
  const teamSeasons: number[] = SEASONS.filter((y) => readSeason(y).coaches.some((c) => c.team === team));
  return (
    <GamePage right="Coaches">
      <header className="co-head">
        <TeamLogo abbr={team} size={44} />
        <div>
          <h1 className="co-h1">{teamNickname(team)} · {season}</h1>
          <p className="co-sub">{coaches.map((c) => c.coach).join(" and ")}{coaches.length > 1 ? " (both head coaches that season)" : ""}</p>
        </div>
      </header>
      <SeasonPicker season={season} hrefFor={(y) => (teamSeasons.includes(y) ? coachHref(team, y) : seasonHref(y))} />
      {coaches.map((c) => <CoachBlock key={c.coach} c={c} />)}
      <p className="co-src"><Link href={seasonHref(season)}>All {season} coaches</Link> · Data: nflverse.</p>
    </GamePage>
  );
}
