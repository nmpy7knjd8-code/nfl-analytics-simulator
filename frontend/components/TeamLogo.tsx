import { teamLogo } from "./ScoreBug";

/** Almost-all-dark logos (measured from public/teams/<ABBR>/logo.png) get a subtle light plate on dark pages. */
const DARK = new Set(["NYG", "LA", "CAR"]);

/** Self-hosted team logo (/teams/<ABBR>/logo.png); decorative, the abbreviation sits next to it. */
export function TeamLogo({ abbr, size = 24 }: { abbr: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogo(abbr)} alt="" width={size} height={size} loading="lazy"
      className={`team-logo${DARK.has(abbr) ? " team-logo-plate" : ""}`}
    />
  );
}
