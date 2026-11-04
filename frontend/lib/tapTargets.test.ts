import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Fix: 44px tap targets on /heatmap and /outcomes (and every chip row).
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8") + readFileSync(new URL("../app/simple-game.css", import.meta.url), "utf8");
const rule = (sel: string) => {
  const ms = [...css.matchAll(new RegExp(`(?:^|[}\\n])${sel.replace(/[.]/g, "\\.")}\\{([^}]*)\\}`, "g"))];
  assert.ok(ms.length, `missing rule ${sel}`);
  return ms.map((m) => m[1]).join(";");
};
const px = (body: string, prop: string) => Number(body.match(new RegExp(`(?:^|;)${prop}:(\\d+)px`))?.[1] ?? 0);

test("heat map squares, chips and brand link are at least 44x44", () => {
  for (const [sel, w, h] of [[".hm-cell", true, true], [".pf-chip", true, true], [".sg-brand", false, true]] as const) {
    const b = rule(sel);
    if (w) assert.ok(px(b, "min-width") >= 44, `${sel} min-width`);
    if (h) assert.ok(px(b, "min-height") >= 44, `${sel} min-height`);
  }
  assert.match(rule(".hm-grid"), /minmax\(44px,1fr\)/);
  assert.doesNotMatch(rule(".ch-chips"), /flex-wrap:wrap/);
});

test("chip rows on /outcomes, /calibration, /era scroll the selected chip into view", () => {
  for (const f of ["OutcomeHistogram", "CalibrationChart", "EraChart"]) {
    assert.match(readFileSync(new URL(`../components/${f}.tsx`, import.meta.url), "utf8"), /<ChipScroll>\s*<div className="pf-chips ch-chips"/);
  }
  assert.match(readFileSync(new URL("../components/ChipScroll.tsx", import.meta.url), "utf8"), /MutationObserver/);
});
