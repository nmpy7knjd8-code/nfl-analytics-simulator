import { createElement as h, type ReactNode } from "react";

/**
 * A play's fan sentence followed by its penalty sentence (#106 moved flags into penalty_text).
 * Every place that renders display_text renders through this so flags never go missing again.
 */
export function PlayPenalty({ text }: { text?: string | null }): ReactNode {
  const t = text?.trim();
  return t ? h("span", { className: "play-penalty" }, t) : null;
}
