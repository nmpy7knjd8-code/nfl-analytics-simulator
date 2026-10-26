import { CoachesSeasonPage } from "../../components/CoachesView";
import { LATEST_SEASON, readSeason } from "../../lib/coaches";

export const metadata = { title: "Coaches · Fourth & Daily" };

export default function CoachesPage() {
  return <CoachesSeasonPage data={readSeason(LATEST_SEASON)} />;
}
