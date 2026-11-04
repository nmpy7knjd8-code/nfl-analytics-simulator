"use client";

import { useEffect, useRef } from "react";

/** Wraps a horizontal chip row and centers the selected chip (.is-on) on mount and whenever the selection changes, without scrolling the page. */
export function ChipScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const center = (smooth: boolean) => {
      for (const row of root.querySelectorAll<HTMLElement>(".pf-chips")) {
        const on = row.querySelector<HTMLElement>(".is-on");
        if (!on || row.scrollWidth <= row.clientWidth) continue;
        const left = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
        row.scrollTo({ left, behavior: smooth ? "smooth" : "auto" });
      }
    };
    center(false);
    const mo = new MutationObserver(() => center(true));
    mo.observe(root, { subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);
  return <div ref={ref}>{children}</div>;
}
