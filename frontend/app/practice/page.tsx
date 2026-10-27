import { SimpleGame } from "../../components/SimpleGame";

export const metadata = { title: "Practice · Fourth & Daily" };

export default function PracticePage() {
  return (
    <main id="main">
      <SimpleGame mode="practice" />
    </main>
  );
}
