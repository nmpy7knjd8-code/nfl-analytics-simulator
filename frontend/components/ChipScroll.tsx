"use client";

import { useEffect, useRef } from "react";

/** Wraps a horizontal chip row and centers the selected chip (.is-on) on mount, without scrolling the page. */
export function ChipScroll({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current?.querySelector<HTMLElement>(".pf-chips");
    const on = row?.querySelector<HTMLElement>(".is-on");
    if (row && on) row.scrollLeft = on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2;
  }, []);
  return <div ref={ref}>{children}</div>;
}
