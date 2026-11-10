import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CHART_HEIGHT,
  CHART_MOTION_MS,
  CSS_VARS,
  FONT_STACK,
  NUMERIC_VARIANT,
  TAP_TARGET_MIN,
  TOKEN_SOURCE,
  axis,
  chartMotionMs,
  colorSchemeCss,
  cssVarDeclarations,
  grid,
  line,
  palettes,
  radius,
  seriesColor,
  space,
  tooltip,
  typeScale,
} from "./chartStyle";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FRONTEND = join(HERE, "..");

test("token source is the Nov 10 provisional iOS Designer set", () => {
  assert.equal(
    TOKEN_SOURCE,
    "provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET",
  );
  const src = readFileSync(new URL("./chartStyle.ts", import.meta.url), "utf8");
  assert.match(src, /provisional \(iOS Designer, Nov 10\); final names in designer PR ~5 AM ET/);
  assert.doesNotMatch(src, /TODO\(iOS tokens\)/);
});

test("light and dark palettes use the provisional iOS colors, not live --sg-b", () => {
  assert.equal(palettes.light.accent, "#007AFF");
  assert.equal(palettes.dark.accent, "#0A84FF");
  assert.notEqual(palettes.light.accent, "#1E5BFF");
  assert.notEqual(palettes.dark.accent, "#1E5BFF");

  assert.equal(palettes.light.label, "#000");
  assert.equal(palettes.dark.label, "#FFF");
  assert.equal(palettes.light.secondaryLabel, "rgba(60,60,67,0.6)");
  assert.equal(palettes.dark.secondaryLabel, "rgba(235,235,245,0.6)");
  assert.equal(palettes.light.separator, "rgba(60,60,67,0.29)");
  assert.equal(palettes.dark.separator, "rgba(84,84,88,0.65)");
  assert.equal(palettes.light.background, "#FFF");
  assert.equal(palettes.dark.background, "#000");
  assert.equal(palettes.light.groupedBackground, "#F2F2F7");
  assert.equal(palettes.dark.groupedBackground, "#000");
  assert.equal(palettes.light.card, "#FFF");
  assert.equal(palettes.dark.card, "#1C1C1E");
  assert.equal(palettes.light.tooltip, "rgba(255,255,255,0.85)");
  assert.equal(palettes.dark.tooltip, "rgba(44,44,46,0.85)");

  // Gridline is the separator at about 50% opacity.
  assert.equal(palettes.light.gridline, "rgba(60,60,67,0.145)");
  assert.equal(palettes.dark.gridline, "rgba(84,84,88,0.325)");
});

test("prefers-color-scheme CSS carries both palettes as --chart-* variables", () => {
  const css = colorSchemeCss();
  assert.match(css, /^:root\{/);
  assert.match(css, /@media \(prefers-color-scheme:dark\)\{:root\{/);
  assert.match(cssVarDeclarations("light"), new RegExp(`${CSS_VARS.accent}:#007AFF`));
  assert.match(cssVarDeclarations("dark"), new RegExp(`${CSS_VARS.accent}:#0A84FF`));
  assert.match(css, /--chart-accent:#007AFF/);
  assert.match(css, /--chart-accent:#0A84FF/);
});

test("font stack, tabular numbers, type scale, radius and spacing", () => {
  assert.equal(
    FONT_STACK,
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif",
  );
  assert.equal(NUMERIC_VARIANT, "tabular-nums");
  assert.deepEqual(typeScale.largeTitle, { fontSize: 34, lineHeight: 41, fontWeight: 700 });
  assert.equal(typeScale.title.fontSize, 28);
  assert.equal(typeScale.title2.fontSize, 22);
  assert.equal(typeScale.title3.fontSize, 20);
  assert.deepEqual(typeScale.headline, { fontSize: 17, fontWeight: 600 });
  assert.equal(typeScale.body.fontSize, 17);
  assert.equal(typeScale.subhead.fontSize, 15);
  assert.equal(typeScale.footnote.fontSize, 13);
  assert.equal(typeScale.caption.fontSize, 12);
  assert.equal(typeScale.caption2.fontSize, 11);
  assert.deepEqual(radius, { card: 16, tooltip: 12, button: 12, chip: 8 });
  assert.deepEqual(space, { 4: 4, 8: 8, 12: 12, 16: 16, 20: 20, 24: 24, 32: 32, gutter: 16 });
});

test("chart defaults: thin horizontal grid, few ticks, round 2.5px lines, 44px taps, phone heights", () => {
  assert.equal(TAP_TARGET_MIN, 44);
  assert.equal(CHART_HEIGHT[360], 200);
  assert.equal(CHART_HEIGHT[390], 216);
  assert.equal(grid.orientation, "horizontal");
  assert.equal(grid.vertical, false);
  assert.equal(grid.border, false);
  assert.ok(grid.minLines >= 3 && grid.maxLines <= 5);
  assert.ok(grid.strokeWidth <= 1);
  assert.equal(axis.fontSize, 12);
  assert.equal(axis.color, "secondaryLabel");
  assert.equal(axis.fewTicks, true);
  assert.equal(line.strokeWidth, 2.5);
  assert.equal(line.lineCap, "round");
  assert.ok(line.areaFillOpacity > 0 && line.areaFillOpacity < 0.4);
  assert.equal(tooltip.backdropBlurPx, 20);
  assert.equal(tooltip.borderRadius, 12);
  assert.equal(tooltip.value.fontWeight, typeScale.headline.fontWeight);
  assert.equal(tooltip.label.fontSize, typeScale.caption.fontSize);
});

test("reduced motion turns chart animation off", () => {
  assert.equal(chartMotionMs(true), 0);
  assert.equal(chartMotionMs(false), CHART_MOTION_MS);
  assert.ok(CHART_MOTION_MS > 0);
});

test("series use team colors when comparing teams, otherwise the accent", () => {
  assert.equal(seriesColor("light"), "#007AFF");
  assert.equal(seriesColor("dark"), "#0A84FF");
  assert.equal(seriesColor("light", { comparingTeams: true, teamColor: "#00338D" }), "#00338D");
  assert.equal(seriesColor("light", { comparingTeams: false, teamColor: "#00338D" }), "#007AFF");
  assert.equal(seriesColor("dark", { comparingTeams: true }), "#0A84FF");
});

test("no existing frontend file imports chartStyle yet (live look unchanged)", () => {
  const skip = new Set(["chartStyle.ts", "chartStyle.test.ts"]);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, name.name);
      if (name.isDirectory()) {
        if (name.name === "node_modules" || name.name === ".next") continue;
        walk(path);
        continue;
      }
      if (skip.has(name.name)) continue;
      if (![".ts", ".tsx", ".js", ".css", ".mjs"].includes(extname(name.name))) continue;
      if (readFileSync(path, "utf8").includes("chartStyle")) hits.push(path.slice(FRONTEND.length + 1));
    }
  };
  walk(FRONTEND);
  assert.deepEqual(hits, []);
});
