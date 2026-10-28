import Link from "next/link";
import { ChipScroll } from "./ChipScroll";
import { TeamLogo } from "./TeamLogo";
import { Header, Trademark } from "./SimpleGame";
import { CHECKER_PAUSED } from "../lib/features";
import {
  type Coach, type CoachCall, type CoachSeason, SEASONS, callLine, callVerdict, coachHref, gradeCell, pctText,
  rankCoaches, regulationOnly, avgText, AVG_LINE, avgPerCall, seasonHref, signedPts, wentWhenShould,
} from "../lib/coaches";

/** Shown instead of any engine number while CHECKER_ENABLED is false (H6). */
export function EnginePaused() {
  return (
    <GamePage right="">
      <section className="co-card" role="status">
        <h1 className="co-h1">{CHECKER_PAUSED.title}</h1>
        <p>{CHECKER_PAUSED.body}</p>
        <Link className="sg-next co-btn" href={CHECKER_PAUSED.cta.href}>{CHECKER_PAUSED.cta.label}</Link>
      </section>
    </GamePage>
  );
}

export { Trademark };

/** Game-style page: white .sg-app card, Fourth & Daily header + ☰ menu, trademark footer (like /kicks, #159). */
export function GamePage({ right, children }: { right: string; children: React.ReactNode }) {
  return (
    <main id="main">
      <div className="sg-app co">
        <Header right={right} />
        {children}
        <Trademark />
      </div>
    </main>
  );
}

export function SeasonPicker({ season, hrefFor = seasonHref }: { season: number; hrefFor?: (s: number) => string }) {
  return (
    <ChipScroll>
    <nav className="pf-chips co-seasons" aria-label="Season">
      {SEASONS.map((s) => (
        <Link key={s} href={hrefFor(s)} className={`pf-chip${s === season ? " is-on" : ""}`} aria-current={s === season ? "page" : undefined}>{s}</Link>
      ))}
    </nav>
    </ChipScroll>
  );
}

function CoachRow({ c, season, rank }: { c: Coach; season: number; rank: number }) {
  return (
    <li>
      <Link href={coachHref(c.team, season)} className="co-row">
        <span className="co-rank">{rank}</span>
        <TeamLogo abbr={c.team} size={28} />
        <span className="co-who"><b>{c.coach}</b><small>{c.team} · {c.qualifying_calls} clear calls · went {pctText(wentWhenShould(c))} when he should</small></span>
        <span className={`co-net${avgPerCall(c) < -0.05 ? " is-neg" : ""}`}>{signedPts(avgPerCall(c))}</span>
      </Link>
    </li>
  );
}

export function CoachesSeasonPage({ data }: { data: CoachSeason }) {
  return (
    <GamePage right="Coaches">
      <header>
        <h1 className="co-h1">Coaches · {data.season}</h1>
        <p className="co-sub">How each head coach&apos;s 4th-down calls matched the model. Number on the right: average win-chance points per call.</p>
      </header>
      <SeasonPicker season={data.season} />
      <ol className="co-list">
        {rankCoaches(data.coaches).map((c, i) => <CoachRow key={c.coach + c.team} c={c} season={data.season} rank={i + 1} />)}
      </ol>
      <p className="co-note">{AVG_LINE}</p>
      <p className="co-src">Data: nflverse ({data.provenance.license}). Clear call: {data.qualifying_rule}.</p>
    </GamePage>
  );
}

function CallList({ title, calls, team }: { title: string; calls: CoachCall[]; team: string }) {
  const shown = regulationOnly(calls);
  return (
    <section className="co-card" aria-label={title}>
      <h2 className="co-h2">{title}</h2>
      {shown.length === 0 ? <p className="co-sub">No calls.</p> : (
        <ol className="co-calls">
          {shown.map((c) => (
            <li key={`${c.game_id}-${c.play_id}`}>
              <p className="co-sit">{callLine(c, team)}</p>
              <p>{callVerdict(c, team)} <span className={c.wp_cost_pts > 0 ? "is-neg" : undefined}>{c.wp_cost_pts > 0 ? `Cost ${c.wp_cost_pts.toFixed(1)} win-chance pts.` : "No cost."}</span></p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function CoachBlock({ c }: { c: Coach }) {
  const g = gradeCell(c);
  return (
    <>
      <section className="co-card">
        <h2 className="co-h2">{c.coach}</h2>
        <dl className="co-stats">
          <div><dt>Clear calls</dt><dd>{c.qualifying_calls}<small> of {c.calls}</small></dd></div>
          <div><dt>Went when he should</dt><dd>{pctText(wentWhenShould(c))}{c.should_go ? <small> of {c.should_go}</small> : null}</dd></div>
          <div><dt>Kicked when he should&apos;ve gone</dt><dd>{c.kicked_when_should_go}</dd></div>
          <div><dt>Went when he should&apos;ve kicked</dt><dd>{c.went_when_should_kick}</dd></div>
          <div><dt>Average per call</dt><dd className={avgPerCall(c) < -0.05 ? "is-neg" : undefined}>{avgText(c)}</dd></div>
          {g.kind === "grade" ? <div><dt>Grade</dt><dd className="co-grade">{g.text}</dd></div> : null}
        </dl>
        <p className="co-note">{AVG_LINE}</p>
      </section>
      <CallList title="Costliest calls" calls={c.worst} team={c.team} />
    </>
  );
}
