import Link from "next/link";
import { DAILY_ITEMS, DAILY_SET_SIZE, MAX_FG_YARDS } from "../../lib/daily";
import retired from "../../lib/retiredDailyIds.json";
import { MODEL_KNOWS, MODEL_DOESNT_KNOW } from "../../lib/modelLimits";
import { Header, Trademark } from "../../components/SimpleGame";

export const metadata = { title: "How it works · Fourth & Daily" };

// The daily pool = lib/dailyPack.json minus lib/retiredDailyIds.json (what scripts/extend-daily-schedule.ts draws from).
const retiredIds = new Set(retired as string[]);
const pool = DAILY_ITEMS.filter((i) => !retiredIds.has(i.id));
const seasons = [...new Set(pool.map((i) => i.source.season))].sort();

export default function AboutPage() {
  return (
    <main id="main">
      <div className="sg-app ab">
        <Header right="About" />
        <h1 className="kb-h1">How it works</h1>
        <h2>The game</h2>
        <p>
          Every day at midnight Eastern you get five real 4th downs from NFL games. Pick Go, Kick or Punt. Then you see what the
          coach did and what our model says gives the team the best chance to win.
        </p>
        <ul>
          <li><strong>Right call:</strong> you picked the option with the best win chance. Worth 1.</li>
          <li><strong>Close call:</strong> when the top two options are within 2 percentage points of win chance, the best one still earns the full point and the other one earns ½.</li>
          <li><strong>Kick</strong> is offered up to {MAX_FG_YARDS} yards. Past that the game shows &ldquo;Too far to kick (65+ yards)&rdquo;. <strong>Punt</strong> isn&apos;t offered inside the opponent&apos;s 35.</li>
          <li>Your streak and stats stay in this browser. No sign-in, nothing sent anywhere.</li>
        </ul>
        <h2>The numbers</h2>
        <p>
          Daily plays come from {pool.length} real regular-season 4th downs from the {seasons.join(" and ")} seasons.
          For each one, the model estimates the team&apos;s chance to win after going for it, kicking or punting, using what usually
          happens next in similar spots (learned from 2019–2021 games). A field goal try is the line of scrimmage plus 18 yards: the ball is snapped about 8 yards back, and the goalposts sit at the back of the 10-yard end zone.
        </p>
        <p>
          These are estimates, not certainties. The win-chance model is not yet calibrated, so treat a gap of a few points as close.
        </p>
        <h2>What the model knows and doesn&apos;t</h2>
        <div className="ml-cols">
          <div><h3>Knows</h3><ul>{MODEL_KNOWS.map((k) => <li key={k}>{k}</li>)}</ul></div>
          <div><h3>Doesn&apos;t know</h3><ul>{MODEL_DOESNT_KNOW.map((k) => <li key={k}>{k}</li>)}</ul></div>
        </div>
        <p>
          With {pool.length} plays and {DAILY_SET_SIZE} a day, the set repeats every {Math.floor(pool.length / DAILY_SET_SIZE)} days.
        </p>
        <h2>Data</h2>
        <p>
          Play-by-play data: <a href="https://github.com/nflverse/nflverse-data">nflverse</a> (CC BY 4.0). Not affiliated with the NFL.
        </p>
        <p><Link href="/">Back to Today&apos;s 5 →</Link></p>
        <Trademark />
      </div>
    </main>
  );
}
