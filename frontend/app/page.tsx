import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero" aria-label="Introduction">
        <h1>NFL Analytics Simulator</h1>
        <p>
          Reconstruct real NFL games from historical play-by-play. Phase 2 is
          replay only — imported reference stats are labeled historical, not
          trained here.
        </p>
        <div className="cta-row">
          <Link className="btn btn-primary" href="/games">
            Open Game Explorer
          </Link>
        </div>
      </section>
      <main className="main">
        <p className="muted">
          Season scope: <span className="mono">2023</span> via nflreadpy 0.1.5 ·
          DuckDB + Parquet lake · no decision lab in this phase.
        </p>
      </main>
    </>
  );
}
