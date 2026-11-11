import Link from "next/link";
import { Header, Trademark } from "../../components/SimpleGame";
import { IosChevron, IosGlyph } from "../../components/IosGlyph";
import { shareMetadata } from "../../lib/share";

export const metadata = shareMetadata({
  title: "More · Fourth & Daily",
  description: "Stats, charts and stories, teams and games, and about Fourth & Daily.",
  path: "/more/",
  card: "home",
  alt: "Fourth & Daily — more: stats, charts, teams, about. Data: nflverse",
});

type Glyph = "practice" | "stats" | "explore" | "about" | "teams" | "rivalry" | "playoffs" | "coaches";

function Row({ href, glyph, label, sub }: { href: string; glyph: Glyph; label: string; sub?: string }) {
  return (
    <li>
      <Link href={href} className="ios-list-row">
        <IosGlyph name={glyph} />
        <span className="ios-list-text">
          <span className="ios-list-label">{label}</span>
          {sub ? <span className="ios-list-sub">{sub}</span> : null}
        </span>
        <IosChevron />
      </Link>
    </li>
  );
}

export default function MorePage() {
  return (
    <main id="main">
      <div className="sg-app ios-more">
        <Header right="More" showMenu={false} />
        <h1 className="ios-large-title sg-today-title">More</h1>
        <nav aria-label="More">
          <ul className="ios-list ios-inset-grouped">
            <Row href="/daily/stats/" glyph="stats" label="Stats" />
            <Row href="/explore/" glyph="explore" label="Explore" sub="Charts and stories" />
            <Row href="/about/" glyph="about" label="About" />
          </ul>
          <h2 className="ios-group-label">Teams &amp; Games</h2>
          <ul className="ios-list ios-inset-grouped">
            <Row href="/team/" glyph="teams" label="Teams" />
            <Row href="/rivalry/" glyph="rivalry" label="Rivalries" />
            <Row href="/playoffs/" glyph="playoffs" label="Playoffs" />
            <Row href="/coaches/" glyph="coaches" label="Coaches" />
          </ul>
        </nav>
        <Trademark />
      </div>
    </main>
  );
}
