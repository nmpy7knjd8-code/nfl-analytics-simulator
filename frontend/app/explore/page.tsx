import Link from "next/link";
import { Header, Trademark } from "../../components/SimpleGame";
import { IosChevron } from "../../components/IosGlyph";
import { shareMetadata } from "../../lib/share";

export const metadata = shareMetadata({
  title: "Explore · Fourth & Daily",
  description: "Charts and stories: kicks, era, comebacks, and more fourth-down views.",
  path: "/explore/",
  card: "home",
  alt: "Fourth & Daily — explore charts and stories. Data: nflverse",
});

const LINKS: { href: string; label: string }[] = [
  { href: "/kicks/", label: "Kicks" },
  { href: "/fake-punt/", label: "Real punt or fake?" },
  { href: "/two-point/", label: "Go for two?" },
  { href: "/era/", label: "Era chart" },
  { href: "/calibration/", label: "Win chance check" },
  { href: "/outcomes/", label: "Where 4th downs land" },
  { href: "/heatmap/", label: "Where coaches go for it" },
  { href: "/match-chart/", label: "Match the chart" },
  { href: "/wheres-the-ball/", label: "Where's the ball?" },
  { href: "/comebacks/", label: "Biggest comebacks" },
  { href: "/on-this-day/", label: "On this day" },
];

export default function ExplorePage() {
  return (
    <main id="main">
      <div className="sg-app ios-explore">
        <Header right="Explore" backHref="/more/" />
        <h1 className="ios-large-title sg-today-title">Explore</h1>
        <p className="sg-today-date">Charts and stories</p>
        <nav aria-label="Explore">
          <ul className="ios-list ios-inset-grouped">
            {LINKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="ios-list-row">
                  <span className="ios-list-text">
                    <span className="ios-list-label">{item.label}</span>
                  </span>
                  <IosChevron />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Trademark />
      </div>
    </main>
  );
}
