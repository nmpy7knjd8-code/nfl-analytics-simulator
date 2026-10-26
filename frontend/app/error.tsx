"use client";

import { EmptyState } from "../components/EmptyState";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="fd-page" id="main">
      <EmptyState kind="error" title="Couldn't load today's plays." body={<p>Check your connection, then try again.</p>} action={{ label: "Try again", onClick: reset }} />
    </main>
  );
}
