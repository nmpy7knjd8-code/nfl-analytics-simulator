"use client";

import { useEffect } from "react";

/** Hide the iOS tab bar while a play session is in progress. */
export function usePlayChrome(active: boolean) {
  useEffect(() => {
    const b = document.body;
    if (active) b.classList.add("ios-play-active");
    else b.classList.remove("ios-play-active");
    return () => { b.classList.remove("ios-play-active"); };
  }, [active]);
}
