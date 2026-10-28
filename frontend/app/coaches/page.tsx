import { CoachesSeasonPage, EnginePaused } from "../../components/CoachesView";
import { LATEST_SEASON, readSeason } from "../../lib/coaches";
import { CHECKER_ENABLED } from "../../lib/features";
import "./coaches.css";

export const metadata = { title: "Coaches · Fourth & Daily" };

export default function CoachesPage() {
  if (!CHECKER_ENABLED) return <EnginePaused />;
  return <CoachesSeasonPage data={readSeason(LATEST_SEASON)} />;
}
