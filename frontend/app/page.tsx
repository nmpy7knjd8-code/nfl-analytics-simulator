import Link from "next/link";
import { TruthChip } from "../components/TruthChip";

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-label="NFL Analytics Simulator">
        <div className="hero-atmosphere" aria-hidden />
        <div className="hero-copy">
          <h1 className="hero-brand">NFL Analytics Simulator</h1>
          <p className="hero-headline">Understand the tough calls — without the jargon.</p>
          <p className="hero-support">
            Walk real games play by play, or ask the simple question: go for it, kick, or punt?
          </p>
          <div className="cta-row">
            <Link className="btn btn-primary" href="/games">
              Open Game Explorer
            </Link>
            <Link className="btn btn-secondary" href="/decide">
              Try 4th &amp; short
            </Link>
          </div>
        </div>
      </section>

      <section className="home-below" id="main">
        <div className="home-paths">
          <article className="home-path">
            <TruthChip kind="historical" />
            <h2>Replay a real game</h2>
            <p>
              Follow what actually happened — downs, distance, and the story of each play — in
              plain language.
            </p>
            <Link className="btn btn-secondary-ink" href="/games">
              Browse games
            </Link>
          </article>
          <article className="home-path">
            <TruthChip kind="simulated" />
            <h2>Fourth-and-short</h2>
            <p>
              Compare go, kick, and punt by chance of winning — example numbers until the live
              decision model is wired in.
            </p>
            <Link className="btn btn-secondary-ink" href="/decide">
              Open the explainer
            </Link>
          </article>
        </div>
      </section>
    </>
  );
}
