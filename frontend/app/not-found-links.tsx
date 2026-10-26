import Link from "next/link";

export function EmptyNav() {
  return (
    <ul className="fd-404-links">
      <li><Link href="/games/">Games</Link></li>
      <li><Link href="/coaches/">Coaches</Link></li>
      <li><Link href="/fourth-down/">Check a 4th down</Link></li>
      <li><Link href="/practice/">Practice</Link></li>
    </ul>
  );
}
