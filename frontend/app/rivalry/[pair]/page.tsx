import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { teamNickname } from "../../../lib/teams";
import { TeamLogo } from "../../../components/TeamLogo";
import { Header, Trademark } from "../../../components/SimpleGame";
import { SEASONS, allPairs, rivalry, seriesLine } from "../../../lib/rivalries";
import "../rivalry.css";

type Props = { params: Promise<{ pair: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return allPairs().map((pair) => ({ pair }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [a, b] = (await params).pair.split("-");
  return { title: `${teamNickname(a)} vs ${teamNickname(b)} · Fourth & Daily` };
}

const fmtDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function RivalryPage({ params }: Props) {
  const { pair } = await params;
  const r = rivalry(pair);
  if (!r) notFound();
  const name = teamNickname;
  return (
    <main id="main">
      <div className="sg-app rv">
        <Header right={pair} />
        <header className="rv-head">
          <span className="rv-team"><TeamLogo abbr={r.a} size={44} /><b>{name(r.a)}</b></span>
          <span className="rv-v">vs</span>
          <span className="rv-team"><TeamLogo abbr={r.b} size={44} /><b>{name(r.b)}</b></span>
        </header>
        <h1 className="rv-h1">{seriesLine(r, name)}</h1>
        <p className="rv-sub">
          {r.meetings.length} {r.meetings.length === 1 ? "meeting" : "meetings"}, {SEASONS[0]}–{SEASONS[SEASONS.length - 1]} · points {name(r.a)} {r.aPts}, {name(r.b)} {r.bPts}
        </p>
        <div className="rv-strip" aria-hidden="true">
          {r.meetings.map((m) => (
            <i key={m.id} className={m.winner === r.a ? "is-a" : m.winner === r.b ? "is-b" : "is-t"} title={m.date} />
          ))}
        </div>
        <p className="rv-key"><i className="is-a" /> {name(r.a)} won <i className="is-b" /> {name(r.b)} won{r.ties ? <> <i className="is-t" /> tie</> : null}</p>
        <ol className="rv-list">
          {[...r.meetings].reverse().map((m) => {
            const body = (
              <>
                <span className="rv-when">{m.round} · {fmtDate(m.date)}</span>
                <span className="rv-score">
                  <span className={m.winner === m.away ? "is-w" : ""}>{m.away} {m.away_score}</span>
                  <span className="rv-at">at</span>
                  <span className={m.winner === m.home ? "is-w" : ""}>{m.home} {m.home_score}</span>
                  {m.overtime ? <span className="rv-ot">OT</span> : null}
                </span>
                {m.story ? <span className="rv-go">Game story →</span> : null}
              </>
            );
            return <li key={m.id}>{m.story ? <Link href={`/games/${m.id}/`} className="rv-row">{body}</Link> : <div className="rv-row">{body}</div>}</li>;
          })}
        </ol>
        <p className="rv-note">
          Regular season and playoffs, newest first.{r.a === "LV" || r.b === "LV" ? " Raiders games from 2019 (Oakland) count as Las Vegas." : ""} Data: nflverse schedules, {SEASONS[0]}–{SEASONS[SEASONS.length - 1]}.
        </p>
        <p className="rv-more"><Link href={`/team/${r.a}/`}>{name(r.a)} team page</Link> · <Link href={`/team/${r.b}/`}>{name(r.b)} team page</Link></p>
        <Trademark />
      </div>
    </main>
  );
}
