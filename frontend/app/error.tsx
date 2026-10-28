"use client";

import { Header } from "../components/SimpleGame";

/** A6: app-wide error state with one way forward. */
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="sg-app">
      <Header right="" />
      <div className="sg-status" role="alert">
        <p>Something went wrong loading this page.</p>
        <button type="button" className="sg-next" onClick={() => reset()}>Try again</button>
      </div>
      <p className="sg-tm-note">Team names and logos are trademarks of the NFL and its teams. Not affiliated.</p>
    </main>
  );
}
