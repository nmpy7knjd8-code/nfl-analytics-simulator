"use client";

import { useEffect } from "react";

/** "See this game at this play": open the quarter holding #play-N and bring it into view. */
export function OpenPlayFromHash() {
  useEffect(() => {
    const open = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id.startsWith("play-")) return;
      const el = document.getElementById(id);
      if (!el) return;
      const det = el.closest("details");
      if (det && !det.open) det.open = true;
      el.scrollIntoView({ block: "center" });
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, []);
  return null;
}
