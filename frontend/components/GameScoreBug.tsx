import { TeamLogo } from "./TeamLogo";
import { scoreBugPanels } from "../lib/scoreBugColors";

/** Compact TV-style score bug: team colors only on the two side panels, AA ink, winner in semibold. */
export function GameScoreBug({
  away,
  home,
  awayScore,
  homeScore,
  overtime,
  week,
  date,
}: {
  away: string;
  home: string;
  awayScore: number | null;
  homeScore: number | null;
  overtime: boolean;
  week: number;
  date: string;
}) {
  const panels = scoreBugPanels(away, home);
  const played = awayScore != null && homeScore != null;
  const awayWin = played && awayScore > homeScore;
  const homeWin = played && homeScore > awayScore;
  const mid = !played ? "Not played" : overtime ? "Final/OT" : "Final";
  const awayLabel = awayScore ?? "—";
  const homeLabel = homeScore ?? "—";
  return (
    <div
      className="gsb"
      role="group"
      aria-label={`${away} ${awayLabel} at ${home} ${homeLabel}, ${mid}, week ${week}${date ? `, ${date}` : ""}`}
    >
      <div className="gsb-side" style={{ background: panels.away.bg, color: panels.away.ink }}>
        <TeamLogo abbr={away} size={24} />
        <span className="gsb-abbr">{away}</span>
        <span className={`gsb-sc${awayWin ? " is-winner" : ""}`}>{awayLabel}</span>
      </div>
      <div className="gsb-mid">
        <span className="gsb-final">{mid}</span>
        <span className="gsb-week">Week {week}</span>
      </div>
      <div className="gsb-side gsb-home" style={{ background: panels.home.bg, color: panels.home.ink }}>
        <span className={`gsb-sc${homeWin ? " is-winner" : ""}`}>{homeLabel}</span>
        <span className="gsb-abbr">{home}</span>
        <TeamLogo abbr={home} size={24} />
      </div>
    </div>
  );
}
