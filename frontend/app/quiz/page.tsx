import { shareMetadata } from "../../lib/share";
import { QuizGame } from "../../components/QuizGame";

export const metadata = shareMetadata({
  title: "Fourth Down Quiz — NFL Analytics Simulator",
  description:
    "Offline fourth-down decision quiz — go, kick, or punt against the model. No live feed.",
  path: "/daily/",
  card: "daily",
  alt: "Today's fourth downs: go, kick, or punt? Data: nflverse",
});

export default function QuizPage() {
  return (
    <main className="quiz-page" id="main">
      <QuizGame />
    </main>
  );
}
