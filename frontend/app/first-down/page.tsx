import { FirstDownGame } from "../../components/FirstDownGame";

export const metadata = { title: "First-down call · Fourth & Daily" };

export default function FirstDownPage() {
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Pass or run?</h1>
        <p className="fd-sub">Five real 1st-and-10 plays a week. Guess the coach&apos;s call. A bonus round, so it doesn&apos;t touch your streak.</p>
      </header>
      <FirstDownGame />
    </main>
  );
}
