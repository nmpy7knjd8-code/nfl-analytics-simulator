import Link from "next/link";
import { EmptyNav } from "./not-found-links";

export const metadata = { title: "Page not found · Fourth & Daily" };

export default function NotFound() {
  return (
    <main className="fd-page" id="main">
      <header className="fd-head">
        <h1>Page not found</h1>
        <p className="fd-sub">That page isn&apos;t here. It may have moved, or the link has a typo.</p>
      </header>
      <section className="fd-card">
        <Link className="fd-btn fd-btn-primary" href="/">Play today&apos;s 5</Link>
        <EmptyNav />
      </section>
    </main>
  );
}
