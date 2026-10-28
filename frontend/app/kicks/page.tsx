import { KickBands } from "../../components/KickBands";

export const metadata = { title: "How far can they kick? · Fourth & Daily" };

export default function KicksPage() {
  return (
    <main className="fd-page" id="main">
      <h1 className="kb-h1">How far can they kick?</h1>
      <p className="kb-lede">Drag the ball back and see how often real field goals went in from there.</p>
      <KickBands />
    </main>
  );
}
