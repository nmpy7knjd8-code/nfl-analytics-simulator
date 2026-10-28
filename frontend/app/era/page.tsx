import { EraChart } from "../../components/EraChart";

export const metadata = { title: "Going for it, then and now · Fourth & Daily" };

export default function EraPage() {
  return (
    <main className="fd-page" id="main">
      <h1 className="kb-h1">Going for it, then and now</h1>
      <p className="kb-lede">How often NFL teams went for it on 4th down, season by season. Tap a season.</p>
      <EraChart />
    </main>
  );
}
