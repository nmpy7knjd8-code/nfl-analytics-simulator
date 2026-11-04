"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Header, Trademark } from "../../../components/SimpleGame";

/** Static page for the reverse order of a pair (GB-DET): sends the reader to the alphabetical URL (DET-GB). */
export function PairRedirect({ to }: { to: string }) {
  useEffect(() => {
    window.location.replace(`../${to}/`);
  }, [to]);
  return (
    <main id="main">
      <meta httpEquiv="refresh" content={`0; url=../${to}/`} />
      <link rel="canonical" href={`../${to}/`} />
      <div className="sg-app rv">
        <Header right={to} />
        <p className="rv-h1">
          This rivalry lives at <Link href={`/rivalry/${to}/`}>{to.replace("-", " vs ")}</Link>.
        </p>
        <Trademark />
      </div>
    </main>
  );
}
