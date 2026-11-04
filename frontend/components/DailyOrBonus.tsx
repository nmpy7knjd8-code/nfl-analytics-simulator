"use client";

import { useEffect, useState } from "react";
import { SimpleGame } from "./SimpleGame";
import { ThemeReveal } from "./ThemeReveal";

/** /daily/#bonus plays the B3 themed bonus 5; plain /daily/ is the untouched daily game. */
export function DailyOrBonus() {
  const [bonus, setBonus] = useState(false);
  useEffect(() => {
    const on = () => setBonus(window.location.hash === "#bonus");
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return bonus ? <ThemeReveal /> : <SimpleGame mode="daily" />;
}
