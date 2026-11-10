import { SimpleGame } from "../components/SimpleGame";
import "./ios-game.css";

export default function HomePage() {
  return (
    <main id="main">
      <SimpleGame mode="daily" />
    </main>
  );
}
