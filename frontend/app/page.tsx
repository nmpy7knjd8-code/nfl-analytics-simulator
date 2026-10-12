import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero page" aria-label="NFL Analytics Simulator" id="main">
      <div className="hero-field" aria-hidden />
      <div className="hero-copy">
        <h1 className="hero-brand">NFL Analytics Simulator</h1>
        <p className="hero-headline">Tough calls, plain English.</p>
        <p className="hero-support">Replay real games — or ask go, kick, or punt?</p>
        <div className="cta-stack">
          <Link className="btn btn-primary" href="/games">
            Open games
          </Link>
          <Link className="btn btn-secondary" href="/decide">
            Try 4th &amp; short
          </Link>
        </div>
      </div>
    </section>
  );
}
