import type { DailyItem } from "../lib/daily";
import { clockText, flagText } from "../lib/simpleGame";
import colors from "../lib/teamColors.json";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const teamLogo = (abbr: string) => `${BASE}/teams/${abbr}/logo.png`;
export const teamWordmark = (abbr: string) => `${BASE}/teams/${abbr}/wordmark.png`;
export const teamColor = (abbr: string, k: "primary" | "secondary" = "primary") =>
  (colors as { teams: Record<string, { primary: string; secondary: string }> }).teams[abbr]?.[k] ?? "#333";

function Dots({ n }: { n: number }) {
  return (
    <span className="sg-to" aria-label={`${n} timeouts left`}>
      {[0, 1, 2].map((i) => <i key={i} className={i < n ? "" : "sg-used"} />)}
    </span>
  );
}

/** TV-style score bug (358×56): away | clock | home, blue flag row with down & distance. */
export function ScoreBug({ item }: { item: DailyItem }) {
  const s = item.situation;
  const home = s.home_team ?? s.defteam;
  const away = s.away_team ?? s.posteam;
  const score = (t: string) => (t === s.posteam ? s.posteam_score : s.defteam_score);
  const to = (t: string) => (t === s.posteam ? s.posteam_timeouts : s.defteam_timeouts);
  const showDots = s.posteam_timeouts != null && s.defteam_timeouts != null;
  const side = (t: string, cls: "a" | "h") => (
    <div className={`sg-tm sg-${cls}${t === s.posteam ? " sg-has" : ""}`}>
      <span className="sg-edge" style={{ background: teamColor(t) }} />
      <span className="sg-pos" aria-hidden="true">{t === s.posteam ? "▶" : ""}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={teamLogo(t)} alt="" width={20} height={20} />
      <span className="sg-code">{t}</span>
      {showDots ? <Dots n={to(t) as number} /> : null}
      <span className="sg-sc">{score(t)}</span>
    </div>
  );
  return (
    <div className="sg-bug" role="group" aria-label={`${away} ${score(away)}, ${home} ${score(home)}, ${s.posteam} has the ball`}>
      <div className="sg-r1">
        {side(away, "a")}
        <div className="sg-clk">{s.qtr >= 5 ? "OT" : `Q${s.qtr}`} {clockText(item)}</div>
        {side(home, "h")}
      </div>
      <div className="sg-r2"><span aria-hidden="true">⚑&nbsp;</span>{flagText(item)}</div>
    </div>
  );
}
