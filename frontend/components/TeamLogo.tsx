import { teamLogo } from "./ScoreBug";


/** Self-hosted team logo (/teams/<ABBR>/logo.png); decorative, the abbreviation sits next to it.
 * Every logo sits on a subtle light plate so dark marks (NYJ, NYG, LA, CAR…) never vanish on dark pages (QA 0217 J). */
export function TeamLogo({ abbr, size = 24 }: { abbr: string; size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={teamLogo(abbr)} alt="" width={size} height={size} loading="lazy"
      className="team-logo team-logo-plate"
    />
  );
}
