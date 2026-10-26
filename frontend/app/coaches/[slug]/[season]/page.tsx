import Link from "next/link";
import { notFound } from "next/navigation";
import { CoachScatter, GradesNote, SeasonPicker } from "../../../../components/CoachesView";
import {
  type Coach,
  type CoachCall,
  SEASONS,
  callLine,
  callStoryHref,
  callVerdict,
  coachHref,
  gradeCell,
  pctText,
  readSeason,
  seasonHref,
  signedPts,
  wentWhenShould,
} from "../../../../lib/coaches";

type Props = { params: Promise<{ slug: string; season: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return SEASONS.flatMap((s) => [...new Set(readSeason(s).coaches.map((c) => c.team))].map((team) => ({ slug: team, season: String(s) })));
}

export async function generateMetadata({ params }: Props) {
  const { slug, season } = await params;
  return { title: `${slug} coach ${season} · Fourth & Daily` };
}

function CallList({ title, calls, team, kind }: { title: string; calls: CoachCall[]; team: string; kind: "best" | "worst" }) {
  return (
    <section className="co-calls" aria-label={title}>
      <h2>{title}</h2>
      {calls.length === 0 ? <p className="fd-muted">No calls.</p> : (
        <ol>
          {calls.map((c) => {
            const href = callStoryHref(c);
            return (
              <li key={`${c.game_id}-${c.play_id}`}>
                <p className="co-call-sit">{callLine(c, team)}</p>
                <p className="co-call-verdict">
                  {callVerdict(c, team)} <span className={kind === "worst" && c.wp_cost_pts > 0 ? "co-neg" : undefined}>
                    {c.wp_cost_pts > 0 ? `Cost ${c.wp_cost_pts.toFixed(1)} win-chance pts.` : "No cost."}
                  </span>{" "}
                  Play {c.result}.
                </p>
                <p className="co-call-desc fd-muted">{c.desc}</p>
                {href ? <Link href={href} className="co-call-link">See this play in Game Story</Link> : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function CoachBlock({ c, season }: { c: Coach; season: number }) {
  const g = gradeCell(c);
  return (
    <article className="co-coach">
      <h2 className="co-coach-name">{c.coach}</h2>
      <dl className="co-stats">
        <div><dt>Clear calls</dt><dd>{c.qualifying_calls} <span className="co-of">of {c.calls} 4th downs</span></dd></div>
        <div><dt>Went when he should</dt><dd>{pctText(wentWhenShould(c))}{c.should_go ? <span className="co-of"> of {c.should_go}</span> : null}</dd></div>
        <div><dt>Kicked when he should&apos;ve gone</dt><dd>{c.kicked_when_should_go}</dd></div>
        <div><dt>Went when he should&apos;ve kicked</dt><dd>{c.went_when_should_kick}</dd></div>
        <div><dt>Net win chance</dt><dd className={c.net_wp_pts < 0 ? "co-neg" : undefined}>{signedPts(c.net_wp_pts)} pts</dd></div>
        <div><dt>Grade</dt><dd className={`co-grade co-grade-${g.kind}`}>{g.text}</dd></div>
      </dl>
      <CallList title="Best 5 calls" calls={c.best} team={c.team} kind="best" />
      <CallList title="Worst 5 calls" calls={c.worst} team={c.team} kind="worst" />
      <p className="fd-muted"><Link href={seasonHref(season)}>All {season} coaches</Link></p>
    </article>
  );
}

export default async function CoachDetail({ params }: Props) {
  const { slug: team, season: s } = await params;
  const season = Number(s);
  if (!(SEASONS as readonly number[]).includes(season)) notFound();
  const data = readSeason(season);
  const coaches = data.coaches.filter((c) => c.team === team);
  if (!coaches.length) notFound();
  const teamSeasons: number[] = SEASONS.filter((y) => readSeason(y).coaches.some((c) => c.team === team));
  return (
    <main className="fd-page co-page" id="main">
      <header className="fd-head">
        <h1>{team} · {season}</h1>
        <p className="fd-sub">{coaches.map((c) => c.coach).join(" and ")}{coaches.length > 1 ? " (both head coaches that season)" : ""}.</p>
      </header>
      <SeasonPicker season={season} hrefFor={(y) => (teamSeasons.includes(y) ? coachHref(team, y) : seasonHref(y))} />
      <GradesNote data={data} />
      <CoachScatter data={data} team={team} />
      {coaches.map((c) => <CoachBlock key={c.coach} c={c} season={season} />)}
      <p className="fd-muted co-source">Data: nflverse ({data.provenance.license}). Model: {data.engine_version}, not yet calibrated.</p>
    </main>
  );
}
