import Link from "next/link";
import { Header, Trademark } from "../../components/SimpleGame";
import { IosChevron, IosGlyph } from "../../components/IosGlyph";
import { shareMetadata } from "../../lib/share";

export const metadata = shareMetadata({
  title: "More · Fourth & Daily",
  description: "Stats, charts and stories, practice, and about Fourth & Daily.",
  path: "/more/",
  card: "home",
  alt: "Fourth & Daily — more: stats, charts, practice, about. Data: nflverse",
});

function Row({ href, glyph, label, sub }: { href: string; glyph: "practice" | "stats" | "explore" | "about"; label: string; sub?: string }) {
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
            <Row href="/practice/" glyph="practice" label="Practice" />
          </ul>
          <ul className="ios-list ios-inset-grouped">
            <Row href="/about/" glyph="about" label="About" />
          </ul>
        </nav>
        <Trademark />
      </div>
    </main>
  );
}
