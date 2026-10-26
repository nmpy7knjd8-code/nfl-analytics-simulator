import Link from "next/link";
import {
  type Coach,
  type CoachSeason,
  SEASONS,
  coachHref,
  gradeCell,
  pctText,
  rankCoaches,
  seasonHref,
  signedPts,
  wentWhenShould,
} from "../lib/coaches";

export function SeasonPicker({ season, hrefFor = seasonHref }: { season: number; hrefFor?: (s: number) => string }) {
  return (
    <nav className="co-seasons" aria-label="Season">
      {SEASONS.map((s) => (
        <Link key={s} href={hrefFor(s)} className={`co-season${s === season ? " is-current" : ""}`} aria-current={s === season ? "page" : undefined}>
          {s}
        </Link>
      ))}
    </nav>
  );
}

/** x = go rate on calls the model says are clear; y = season net win chance. Grey dots, selected team blue. */
export function CoachScatter({ data, team }: { data: CoachSeason; team?: string }) {
  const W = 400, H = 260, L = 40, R = 12, T = 12, B = 34;
  const cs = data.coaches;
  const maxX = Math.max(0.5, ...cs.map((c) => c.go_rate));
  const ys = cs.map((c) => c.net_wp_pts);
  const lo = Math.min(-10, ...ys), hi = Math.max(10, ...ys);
  const x = (v: number) => L + (v / maxX) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const sel = cs.filter((c) => c.team === team);
  const rest = cs.filter((c) => c.team !== team);
  // Units on every tick, and a real minus sign, so a summed swing never reads like a price line.
  const tick = (v: number) => `${v < 0 ? "\u2212" : "+"}${Math.abs(Math.round(v))} pts`;
  return (
    <figure className="co-fig">
      <svg viewBox={`0 0 ${W} ${H}`} className="co-scatter" role="img" aria-label={`Each dot is a ${data.season} head coach: go rate across, net win chance up and down.${sel.length ? ` ${team} in blue.` : ""}`}>
        <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="co-zero" />
        <line x1={L} x2={L} y1={T} y2={H - B} className="co-axis" />
        <text x={L - 6} y={y(hi) + 4} textAnchor="end" className="co-tick">{tick(hi)}</text>
        <text x={L - 6} y={y(0) + 4} textAnchor="end" className="co-tick">0</text>
        <text x={L - 6} y={y(lo) + 4} textAnchor="end" className="co-tick">{tick(lo)}</text>
        <text x={L} y={H - B + 16} className="co-tick">0%</text>
        <text x={W - R} y={H - B + 16} textAnchor="end" className="co-tick">{Math.round(maxX * 100)}%</text>
        <text x={(L + W - R) / 2} y={H - 4} textAnchor="middle" className="co-tick">Went-for-it rate on clear calls</text>
        {rest.map((c) => <circle key={c.coach + c.team} cx={x(c.go_rate)} cy={y(c.net_wp_pts)} r={4} className="co-dot"><title>{`${c.coach} (${c.team})`}</title></circle>)}
        {sel.map((c) => <circle key={c.coach} cx={x(c.go_rate)} cy={y(c.net_wp_pts)} r={6} className="co-dot is-sel"><title>{`${c.coach} (${c.team})`}</title></circle>)}
      </svg>
      <figcaption className="fd-muted">Up = win chance gained over the season by his 4th-down calls; down = lost (win-chance points, summed).</figcaption>
    </figure>
  );
}

function GradeText({ c }: { c: Coach }) {
  const g = gradeCell(c);
  return <span className={`co-grade co-grade-${g.kind}`}>{g.text}</span>;
}

export function CoachTable({ data, team }: { data: CoachSeason; team?: string }) {
  return (
    <div className="co-table-wrap" tabIndex={0} role="region" aria-label={`${data.season} coaches table`}>
      <table className="co-table">
        <thead>
          <tr>
            <th scope="col">Coach</th>
            <th scope="col">Team</th>
            <th scope="col">Calls</th>
            <th scope="col">Went when he should</th>
            <th scope="col">Kicked when he should&apos;ve gone</th>
            <th scope="col">Net win chance</th>
            <th scope="col">Grade</th>
          </tr>
        </thead>
        <tbody>
          {rankCoaches(data.coaches).map((c) => (
            <tr key={c.coach + c.team} className={c.team === team ? "is-sel" : undefined}>
              <th scope="row"><Link href={coachHref(c.team, data.season)}>{c.coach}</Link></th>
              <td>{c.team}</td>
              <td>{c.qualifying_calls}</td>
              <td>{pctText(wentWhenShould(c))}{c.should_go ? <span className="co-of"> of {c.should_go}</span> : null}</td>
              <td>{c.kicked_when_should_go}</td>
              <td className={c.net_wp_pts < 0 ? "co-neg" : undefined}>{signedPts(c.net_wp_pts)}</td>
              <td><GradeText c={c} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function GradesNote({ data }: { data: CoachSeason }) {
  return (
    <p className="co-note" role="note">
      <strong>Grades coming once the model is calibrated.</strong> Letter grades wait for the calibrated win-chance model (#37).
      Coaches with fewer than {data.min_calls_for_grade} clear calls show &ldquo;Not enough calls&rdquo; and won&apos;t get a grade.
    </p>
  );
}

export function CoachesSeasonPage({ data }: { data: CoachSeason }) {
  return (
    <main className="fd-page co-page" id="main">
      <header className="fd-head">
        <h1>Coaches · {data.season}</h1>
        <p className="fd-sub">How each head coach&apos;s 4th-down calls lined up with the model. Calls counts only clear calls ({data.qualifying_rule}).</p>
      </header>
      <SeasonPicker season={data.season} />
      <GradesNote data={data} />
      <CoachScatter data={data} />
      <CoachTable data={data} />
      <p className="fd-muted co-source">Data: nflverse ({data.provenance.license}). Model: {data.engine_version}, not yet calibrated.</p>
    </main>
  );
}
