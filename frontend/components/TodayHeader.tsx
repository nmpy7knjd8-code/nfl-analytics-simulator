"use client";

import { useEffect, useState } from "react";
import { dateKey } from "../lib/daily";

export function TodayHeader() {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const [y, m, d] = dateKey(new Date()).split("-").map(Number);
    setLabel(new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }));
  }, []);
  return (
    <header className="fd-head">
      <p className="fd-date">{label || "\u00a0"}</p>
      <h1>Today&apos;s 5</h1>
      <p className="fd-sub">Five real 4th downs. Go, kick or punt? New set at midnight ET.</p>
    </header>
  );
}
