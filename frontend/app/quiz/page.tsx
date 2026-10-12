import { QuizGame } from "../../components/QuizGame";

export const metadata = {
  title: "Fourth Down Quiz — NFL Analytics Simulator",
  description:
    "Offline fourth-down decision quiz — go, kick, or punt against the model. No live feed.",
};

export default function QuizPage() {
  return (
    <main className="quiz-page" id="main">
      <QuizGame />
    </main>
  );
}
