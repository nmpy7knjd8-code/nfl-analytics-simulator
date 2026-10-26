import Link from "next/link";
import { notFound } from "next/navigation";
import { GameChart } from "../../../components/GameChart";
import { GameScrubber, type ScrubPoint } from "../../../components/GameScrubber";
import { OpenPlayFromHash } from "../../../components/OpenPlayFromHash";
import { readGameFile } from "../../../lib/gameFiles";
import {
  grade, hasStory, longDate, narrator, numberedSwings, periodName, quarters, STORY_GAME_IDS, winner, wpLabel,
} from "../../../lib/gameStory";

type Props = { params: Promise<{ gameId: string }> };

export function generateStaticParams() {
  return STORY_GAME_IDS.map((gameId) => ({ gameId }));
}

export async function generateMetadata({ params }: Props) {
  const { gameId } = await params;
  if (!hasStory(gameId)) return {};
  const g = readGameFile(gameId).game;
  return { title: `${g.away} @ ${g.home}, ${g.season} Week ${g.week} · Fourth & Daily` };
}

function downText(down: number | null, togo: number, yl: number | null, posteam: string | null, defteam: string) {
  if (down == null) return "";
  const spot = yl == null ? "" : yl === 50 ? " at midfield" : yl < 50 ? ` at ${defteam} ${yl}` : ` at ${posteam} ${100 - yl}`;
  return `${down}${["", "st", "nd", "rd", "th"][down]} & ${togo}${spot}`;
}

export default async function GameStoryPage({ params }: Props) {
  const { gameId } = await params;
  if (!hasStory(gameId)) notFound();
  const file = readGameFile(gameId);
  const g = file.game;
  const w = winner(g);
  const swings = numberedSwings(file);
  const swingN = new Map(swings.map((s) => [s.play.play_id, s.n]));
  const story = narrator(file);
  const other = (t: string | null) => (t === g.home ? g.away : g.home);
  const scrub: ScrubPoint[] = file.plays.map((p) => ({
    label: `${periodName(p.qtr)} ${p.clock}`,
    wp: wpLabel(p.home_wp_after, g.home, g.away),
    score: `${g.away} ${p.away_score} – ${g.home} ${p.home_score}`,
    text: p.text,
  }));

  return (
    <main className="fd-page gs-page" id="main">
      <OpenPlayFromHash />
      <Link className="gs-back" href="/games/">← Games</Link>
      <header className="gs-head">
        <h1 className="gs-score">
          <span className={w === g.away ? "is-win" : undefined}>{g.away} {g.away_score}</span>
          <span className="gs-at"> @ </span>
          <span className={w === g.home ? "is-win" : undefined}>{g.home} {g.home_score}</span>
          {g.overtime ? <span className="gs-at"> · OT</span> : null}
        </h1>
        <p className="fd-muted">
          {longDate(g.date)} · {g.season} Week {g.week} · {g.stadium}
        </p>
      </header>

      <section className="fd-card" aria-labelledby="gs-chart-h">
        <h2 id="gs-chart-h" className="gs-h2">{g.home} win chance</h2>
        <p className="fd-muted gs-cap">Higher = better for {g.home}. Dashed line = 50%. Numbered dots = swing plays (win chance moved {Math.round(file.swing_threshold * 100)}+ points).</p>
        <GameChart file={file} swings={swings} />
        <GameScrubber points={scrub} />
      </section>

      <section className="fd-card" aria-labelledby="gs-story-h">
        <h2 id="gs-story-h" className="gs-h2">The story</h2>
        <div className="gs-narr">
          {story.map((s) => <p key={s}>{s}</p>)}
        </div>
        <ol className="gs-swings" aria-label="Swing plays">
          {swings.map((s) => (
            <li key={s.play.play_id}>
              <a href={`#play-${s.play.play_id}`}>
                <span className="gs-n">{s.n}</span>
                <span>
                  <strong>{periodName(s.play.qtr)} {s.play.clock}</strong> · {wpLabel(s.play.home_wp, g.home, g.away)} → {wpLabel(s.play.home_wp_after, g.home, g.away)}
                  <span className="gs-swing-text">{s.play.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="gs-plays-h" className="gs-plays">
        <h2 id="gs-plays-h" className="gs-h2">Every play</h2>
        {quarters(file).map((q) => (
          <details key={q.qtr} className="gs-q">
            <summary>{periodName(q.qtr)} · {q.plays.length} plays</summary>
            <ol className="gs-playlist">
              {q.plays.map((p) => {
                const n = swingN.get(p.play_id);
                const gr = p.fourth_down ? grade(p.fourth_down) : null;
                return (
                  <li key={p.play_id} id={`play-${p.play_id}`} className={n ? "gs-play is-swing" : "gs-play"}>
                    <div className="gs-play-top">
                      <span>
                        {n ? <span className="gs-n">{n}</span> : null}
                        {p.clock}{p.posteam && p.down ? ` · ${p.posteam} ${downText(p.down, p.ydstogo, p.yardline_100, p.posteam, other(p.posteam))}` : ""}
                      </span>
                      <span className="gs-wp">{wpLabel(p.home_wp_after, g.home, g.away)}</span>
                    </div>
                    <p className="gs-play-text">{p.text}</p>
                    {gr ? <p className={`gs-grade is-${gr.tone}`}>4th down · {gr.label}</p> : null}
                  </li>
                );
              })}
            </ol>
          </details>
        ))}
      </section>

      <p className="fd-muted gs-source">
        Source: {file.provenance.source} play-by-play via nflreadpy {file.provenance.nflreadpy_version} · data {file.provenance.data_sha256.slice(0, 12)} · built {file.provenance.build_date}. Win chance is nflverse&apos;s model; 4th-down calls are this site&apos;s engine.
      </p>
    </main>
  );
}
