import Link from "next/link";
import pack from "../../lib/quizPack.json";

export const metadata = { title: "How it works · Fourth & Daily" };

const seasons = [...new Set((pack.items as { source: { season: number } }[]).map((i) => i.source.season))].sort();

export default function AboutPage() {
  return (
    <main className="fd-page fd-prose" id="main">
      <h1>How it works</h1>
      <h2>The game</h2>
      <p>
        Every day at midnight Eastern you get five real 4th downs from NFL games. Pick Go, Kick or Punt. Then you see what the
        coach did and what our model says gives the team the best chance to win.
      </p>
      <ul>
        <li><strong>Right call:</strong> you picked the option with the best win chance. Worth 1.</li>
        <li><strong>Close call:</strong> when the top two options are within 2 points of win chance, the best one still earns the full point and the other one earns ½.</li>
        <li><strong>Kick</strong> isn&apos;t offered at 65+ yards: the game shows &ldquo;Too far to kick (65+ yards)&rdquo;. <strong>Punt</strong> isn&apos;t offered inside the opponent&apos;s 35.</li>
        <li>Your streak and stats stay in this browser. No sign-in, nothing sent anywhere.</li>
      </ul>
      <h2>The numbers</h2>
      <p>
        Today&apos;s plays come from {pack.items.length} real regular-season 4th downs from the {seasons.join(" and ")} seasons.
        For each one, the model estimates the team&apos;s chance to win after going for it, kicking or punting, using what usually
        happens next in similar spots (learned from 2019–2021 games). A field goal try is the line of scrimmage plus 18 yards: the ball is snapped about 8 yards back, and the goalposts sit at the back of the 10-yard end zone.
      </p>
      <p>
        These are estimates, not certainties. The win-chance model is not yet calibrated, so treat a gap of a few points as close.
      </p>
      <p>
        With {pack.items.length} plays and 5 a day, the set repeats every {Math.floor(pack.items.length / 5)} days.
      </p>
      <h2>Data</h2>
      <p>
        Play-by-play data:{" "}
        <a href="https://github.com/nflverse/nflverse-data">nflverse</a> (CC BY 4.0). Not affiliated with the NFL.
      </p>
      <p>
        <Link href="/">Back to Today&apos;s 5 →</Link>
      </p>
    </main>
  );
}
