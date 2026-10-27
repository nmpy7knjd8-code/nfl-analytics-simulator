import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The reveal pill must be an HTML overlay inside .sg-field that can't overflow it (P1: clipped at 360/1280).
// Browser check at 360/390/1280: scripts/check-result-pill.mjs (Playwright, run locally).
const css = readFileSync(join(process.cwd(), "app", "simple-game.css"), "utf8");
const src = readFileSync(join(process.cwd(), "components", "FieldView.tsx"), "utf8");
const rule = css.match(/\.sg-pill\{([^}]*)\}/)?.[1] ?? "";

test("result pill is HTML inside .sg-field, not SVG", () => {
  assert.match(src, /<\/svg>\s*\{reveal \? <div className="sg-pill"/);
  assert.doesNotMatch(src, /chipW|chipX/);
});

test("result pill is constrained to the field box", () => {
  assert.match(css, /\.sg-field\{position:relative\}/);
  for (const d of ["position:absolute", "left:50%", "transform:translateX(-50%)", "max-width:calc(100% - 16px)",
    "box-sizing:border-box", "white-space:nowrap", "overflow:hidden", "text-overflow:ellipsis"]) assert.ok(rule.includes(d), d);
});
