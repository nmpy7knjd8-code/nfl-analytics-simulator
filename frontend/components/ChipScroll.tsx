"use client";

import { useEffect, useRef } from "react";

/** S3 fade: a fade on any side that has more chips to scroll to (same cue as the play-feed chip row). */
function updateFades(row: HTMLElement) {
  const l = row.scrollLeft > 2;
  const r = row.scrollLeft + row.clientWidth < row.scrollWidth - 2;
  row.classList.toggle("fade-l", l);
  row.classList.toggle("fade-r", r);
}

/** Wraps a horizontal chip row and scrolls the selected chip (.is-on) fully into view on mount and whenever the selection changes, without scrolling the page. */
export function ChipScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const rows = () => [...root.querySelectorAll<HTMLElement>(".pf-chips")];
    const center = (smooth: boolean) => {
      for (const row of rows()) {
        const on = row.querySelector<HTMLElement>(".is-on");
        if (on && row.scrollWidth > row.clientWidth) {
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
        updateFades(row);
      }
    };
    const onScroll = (e: Event) => updateFades(e.currentTarget as HTMLElement);
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      for (const row of rows()) updateFades(row);
    });
    for (const row of rows()) {
      row.addEventListener("scroll", onScroll, { passive: true });
      ro?.observe(row);
    }
    center(false);
    // Chip widths change once the web font loads; re-check then.
    document.fonts?.ready.then(() => center(false));
    const mo = new MutationObserver((muts) => {
      // Ignore fade-l/fade-r toggles on the row itself so we don't loop.
      if (muts.every((m) => m.target instanceof HTMLElement && m.target.classList.contains("pf-chips"))) return;
      center(true);
    });
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => {
      mo.disconnect();
      ro?.disconnect();
      for (const row of rows()) row.removeEventListener("scroll", onScroll);
    };
  }, []);
  return <div ref={ref}>{children}</div>;
}
