import type { DailyItem } from "../lib/daily";
import { limitsFor, type LimitFacts } from "../lib/modelLimits";

/** F6: collapsed "What the numbers can't see" row on the reveal card. */
export function ModelLimits({ item, facts }: { item: DailyItem; facts?: LimitFacts }) {
  const limits = limitsFor(item, facts);
  return (
    <details className="ml">
      <summary className="ml-sum">What the numbers can&apos;t see</summary>
      <ul className="ml-list">
        {limits.map((l) => <li key={l.id}>{l.text}</li>)}
      </ul>
    </details>
  );
}
