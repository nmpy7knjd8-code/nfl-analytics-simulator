"use client";

import { useEffect, useRef } from "react";

/** Wraps a horizontal chip row and scrolls the selected chip (.is-on) fully into view on mount and whenever the selection changes, without scrolling the page. */
export function ChipScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const center = (smooth: boolean) => {
      for (const row of root.querySelectorAll<HTMLElement>(".pf-chips")) {
        const on = row.querySelector<HTMLElement>(".is-on");
        if (!on || row.scrollWidth <= row.clientWidth) continue;
        // Scroll only as far as needed to show the selected chip fully (clear of the edge fades); otherwise keep the row at its left edge.
        const pad = 28;
        const r = row.getBoundingClientRect(), c = on.getBoundingClientRect();
        const start = c.left - r.left - row.clientLeft + row.scrollLeft;
        const end = start + c.width;
        let left = row.scrollLeft;
        if (start - pad < left) left = Math.max(0, start - pad);
        else if (end + pad > left + row.clientWidth) left = end + pad - row.clientWidth;
        if (left !== row.scrollLeft) row.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
      }
    };
    center(false);
    // Chip widths change once the web font loads; re-check then.
    document.fonts?.ready.then(() => center(false));
    const mo = new MutationObserver(() => center(true));
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}
