import { teamColorSet, textOn } from "../lib/teamColors";

/** Small team chip: abbreviation always shown; text color picked for AA on the team color. */
export function TeamChip({ team, color }: { team: string; color?: string | null }) {
  const fill = color ?? teamColorSet(team)?.primary ?? null;
  if (!fill) return <span className="team-chip">{team}</span>;
  return (
    <span className="team-chip is-team" style={{ background: fill, color: textOn(fill) }}>
      {team}
    </span>
  );
}
