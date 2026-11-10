import type { DailyItem } from "../lib/daily";
import { clockText, flagText } from "../lib/simpleGame";
import { teamPanels } from "../lib/tvBug";
import { teamLogo } from "./ScoreBug";

/** Possession football, drawn in the panel ink (no extra colors on the bug). */
function Ball() {
  return (
    <svg className="tv-ball" viewBox="0 0 24 24" aria-hidden="true">
      <ellipse cx="12" cy="12" rx="9.4" ry="6.3" transform="rotate(-28 12 12)" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8.8 13.7c2.4-1.5 4.8-2.6 7.2-3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * iOS v2 TV score bug for the live daily game: team-color halves (nflverse primary, AA ink and clash
 * fallback from lib/tvBug), self-hosted logos on a white plate, Q + clock in the middle, blue down-and-distance flag.
 * Same data as ScoreBug; ScoreBug stays as-is for the other pages.
 */
export function TvScoreBug({ item }: { item: DailyItem }) {
  const s = item.situation;
  const home = s.home_team ?? s.defteam;
  const away = s.away_team ?? s.posteam;
  const score = (t: string) => (t === s.posteam ? s.posteam_score : s.defteam_score);
  const to = (t: string) => (t === s.posteam ? s.posteam_timeouts : s.defteam_timeouts);
  const showDots = s.posteam_timeouts != null && s.defteam_timeouts != null;
  const panels = teamPanels(away, home);
  const side = (t: string, cls: "a" | "h") => {
    const p = cls === "a" ? panels.away : panels.home;
    const n = to(t) as number;
    return (
      <div className={`tv-side tv-${cls}`} style={{ background: p.bg, color: p.ink }}>
        <span className="tv-plate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={teamLogo(t)} alt="" width={18} height={18} />
        </span>
        <span className="tv-id">
          <span className="tv-code">{t}{t === s.posteam ? <Ball /> : null}</span>
          {showDots ? (
            <span className="tv-to" aria-label={`${n} timeouts left`}>
              {[0, 1, 2].map((i) => <i key={i} className={i < n ? "" : "tv-used"} />)}
            </span>
          ) : null}
        </span>
        <span className="tv-sc">{score(t)}</span>
      </div>
    );
  };
  return (
    <div className="tv" role="group" aria-label={`${away} ${score(away)}, ${home} ${score(home)}, ${s.posteam} has the ball`}>
      <div className="tv-r1">
        {side(away, "a")}
        <div className="tv-clk"><span className="tv-q">{s.qtr >= 5 ? "OT" : `Q${s.qtr}`}</span><span className="tv-t">{clockText(item)}</span></div>
        {side(home, "h")}
      </div>
      <div className="tv-flag">{flagText(item)}</div>
    </div>
  );
}
