import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { teamNickname } from "../../../lib/teams";
import { TeamLogo } from "../../../components/TeamLogo";
import { Header, Trademark } from "../../../components/SimpleGame";
import { SEASONS, bracket, type PGame } from "../../../lib/playoffs";
import "../playoffs.css";

type Props = { params: Promise<{ season: string }> };

export const dynamicParams = false;
export function generateStaticParams() {
  return SEASONS.map((s) => ({ season: String(s) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { season } = await params;
  return { title: `${season} playoffs · Fourth & Daily` };
}

const fmtDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

function Side({ t, pts, won }: { t: string; pts: number; won: boolean }) {
  return (
    <span className={`po-side${won ? " is-w" : ""}`}>
      <TeamLogo abbr={t} size={24} />
      <span className="po-name">{teamNickname(t)}</span>
      <span className="po-pts">{pts}</span>
    </span>
  );
}

function GameCard({ g }: { g: PGame }) {
  const body = (
    <>
      <Side t={g.away} pts={g.away_score} won={g.winner === g.away} />
      <Side t={g.home} pts={g.home_score} won={g.winner === g.home} />
      <span className="po-meta">
        {fmtDate(g.date)}{g.overtime ? <span className="po-ot">OT</span> : null}
        {g.story ? <span className="po-go">Game story →</span> : null}
      </span>
    </>
  );
  return <li>{g.story ? <Link href={`/games/${g.id}/`} className="po-game">{body}</Link> : <div className="po-game">{body}</div>}</li>;
}

export default async function PlayoffsPage({ params }: Props) {
  const season = Number((await params).season);
  if (!(SEASONS as readonly number[]).includes(season)) notFound();
  const b = bracket(season);
  return (
    <main id="main">
      <div className="sg-app po">
        <Header right="Playoffs" />
        <h1 className="po-h1">Road to Super Bowl {b.sbNumber}</h1>
        <p className="po-sub">{season} season · champion: {teamNickname(b.champion)}</p>
        <nav className="pf-chips po-chips" aria-label="Season">
          {SEASONS.map((s) => (
            <Link key={s} href={`/playoffs/${s}/`} className={`pf-chip${s === season ? " is-on" : ""}`} aria-current={s === season ? "page" : undefined}>{s}</Link>
          ))}
        </nav>
        {b.rounds.map((r) => (
          <section key={r.key} className="po-round" aria-labelledby={`po-${r.key}`}>
            <h2 id={`po-${r.key}`} className="po-h2">{r.name}</h2>
            {r.key === "SB" ? (
              <ol className="po-games"><GameCard g={r.games[0]} /></ol>
            ) : (
              (["AFC", "NFC"] as const).map((c) => (
                <div key={c} className="po-conf">
                  <h3 className="po-h3">{c}</h3>
                  <ol className="po-games">{r.games.filter((g) => g.conf === c).map((g) => <GameCard key={g.id} g={g} />)}</ol>
                </div>
              ))
            )}
          </section>
        ))}
        <p className="po-note">Winner in bold. Data: nflverse schedules, {season} season playoffs.</p>
        <Trademark />
      </div>
    </main>
  );
}
