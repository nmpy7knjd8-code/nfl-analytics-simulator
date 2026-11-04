import { Header, Trademark } from "../../components/SimpleGame";
import { OnThisDay } from "../../components/stories/OnThisDay";

export const metadata = { title: "On this day · Fourth & Daily" };

/** Preview page for the G4 card; Integration decides where the card mounts. */
export default function OnThisDayPage() {
  return (
    <main id="main">
      <div className="sg-app st-app">
        <Header right="On this day" />
        <h1 className="st-h1">On this day</h1>
        <p className="st-sub">NFL games played on today&apos;s date in past seasons.</p>
        <OnThisDay />
        <Trademark />
      </div>
    </main>
  );
}
