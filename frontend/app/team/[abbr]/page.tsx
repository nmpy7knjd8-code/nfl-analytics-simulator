import type { Metadata } from "next";
import { notFound } from "next/navigation";
import colors from "../../../lib/teamColors.json";
import { teamNickname } from "../../../lib/teams";
import { TeamLogo } from "../../../components/TeamLogo";
import { REDZONE, pct, redzoneFor } from "../../../lib/teamRedzone";
import "../team.css";

type Props = { params: Promise<{ abbr: string }> };
const TEAMS = (colors as { teams: Record<string, { primary: string; secondary: string }> }).teams;

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(TEAMS).map((abbr) => ({ abbr }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { abbr } = await params;
  return { title: `${teamNickname(abbr)} · Fourth & Daily` };
}

export default async function TeamPage({ params }: Props) {
  const { abbr } = await params;
  const c = TEAMS[abbr];
  const row = redzoneFor(abbr);
  if (!c || !row) notFound();
  const lg = REDZONE.league;
  const diff = Math.round((row.td_rate - lg.td_rate) * 100);
  const n = REDZONE.teams.length;
  const [s0, s1] = REDZONE.seasons;
  const seg = (v: number) => `${(v / row.drives) * 100}%`;
  return (
    <main className="fd-page tm-page" id="main" style={{ "--tm-c": c.primary, "--tm-c2": c.secondary } as React.CSSProperties}>
      <header className="tm-head">
        <TeamLogo abbr={abbr} size={48} />
        <div>
          <h1>{teamNickname(abbr)}</h1>
          <p className="tm-sub">{abbr} · {s0}–{s1} regular season</p>
        </div>
      </header>

      <section className="tm-card" aria-labelledby="rz-h">
        <h2 id="rz-h">Red zone</h2>
        {REDZONE.stub ? <p className="tm-stub">Sample numbers for layout only. Real data coming soon.</p> : null}
        <p className="tm-big"><span>{pct(row.td_rate)}</span> of trips end in a touchdown</p>
        <p className="tm-vs">
          League: {pct(lg.td_rate)} · {diff === 0 ? "same as the league" : `${Math.abs(diff)} pts ${diff > 0 ? "better" : "worse"}`} · #{row.rank} of {n}
        </p>
        <div className="tm-bars" aria-hidden="true">
          <div className="tm-row"><span>{abbr}</span><div className="tm-bar"><i style={{ width: pct(row.td_rate) }} /></div></div>
          <div className="tm-row"><span>NFL</span><div className="tm-bar tm-bar-lg"><i style={{ width: pct(lg.td_rate) }} /></div></div>
        </div>
        <div className="tm-split" role="img" aria-label={`${row.td} touchdowns, ${row.fg} field goals, ${row.no_score} no points, out of ${row.drives} trips`}>
          <i className="tm-s-td" style={{ width: seg(row.td) }} />
          <i className="tm-s-fg" style={{ width: seg(row.fg) }} />
          <i className="tm-s-no" style={{ width: seg(row.no_score) }} />
        </div>
        <ul className="tm-legend">
          <li><b className="tm-s-td" />TD {row.td}</li>
          <li><b className="tm-s-fg" />FG {row.fg}</li>
          <li><b className="tm-s-no" />No points {row.no_score}</li>
        </ul>
        <p className="tm-note">{row.drives} trips inside the opponent 20. Data: nflverse.</p>
      </section>

      <p className="sg-tm-note">Team names and logos are trademarks of the NFL and its teams. Not affiliated.</p>
    </main>
  );
}
