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
  TOOLTIP_BLUR_PX,
  axis,
  chartMotionMs,
  grid,
  line,
  palettes,
  radius,
  seriesColor,
  space,
  tooltip,
  typeScale,
} from "./chartStyle";
import {
  iosChart,
  iosColor,
  iosFonts,
  iosMetrics,
  iosRadius,
  iosSpace,
  iosType,
} from "./tokens";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const FRONTEND = join(HERE, "..");
const tokensCss = readFileSync(new URL("../app/tokens.css", import.meta.url), "utf8");
const shellCss = readFileSync(new URL("../app/ios-shell.css", import.meta.url), "utf8");
const src = readFileSync(new URL("./chartStyle.ts", import.meta.url), "utf8");

test("chartStyle derives from #325 tokens and has no provisional comments", () => {
  assert.match(src, /from "\.\/tokens"/);
  assert.doesNotMatch(src, /provisional/i);
  assert.doesNotMatch(src, /TODO\(iOS tokens\)/);
  assert.equal(FONT_STACK, iosFonts.text);
  assert.equal(NUMERIC_VARIANT, "tabular-nums");
  assert.equal(TAP_TARGET_MIN, iosMetrics.touch);
  assert.ok(TAP_TARGET_MIN >= 44);
  assert.equal(typeScale, iosType);
});

test("light and dark palettes come from iosColor / iosChart, not --sg-b", () => {
  for (const theme of ["light", "dark"] as const) {
    const p = palettes[theme];
    const c = iosColor[theme];
    const ch = iosChart[theme];
    assert.equal(p.accent, c.accent);
    assert.equal(p.label, c.labelPrimary);
    assert.equal(p.secondaryLabel, c.labelSecondary);
    assert.equal(p.separator, c.separator);
    assert.equal(p.gridline, ch.grid);
    assert.equal(p.axis, ch.axis);
    assert.equal(p.background, c.backgroundSecondary);
    assert.equal(p.groupedBackground, c.backgroundGrouped);
    assert.equal(p.card, c.backgroundElevated);
    assert.equal(p.tooltip, c.backgroundElevated);
    assert.equal(p.band, ch.band);
    assert.equal(p.series, ch.series);
    assert.equal(p.shadow, c.shadowCard);
  }
  assert.equal(palettes.light.accent, "#007aff");
  assert.equal(palettes.dark.accent, "#0a84ff");
  assert.notEqual(palettes.light.accent, "#1E5BFF");
  assert.notEqual(palettes.dark.accent, "#1E5BFF");
  assert.notEqual(palettes.light.accent, palettes.dark.accent);
  assert.notEqual(palettes.light.label, palettes.dark.label);
  assert.notEqual(palettes.light.gridline, palettes.dark.gridline);
});

test("CSS vars point at tokens.css --ios-* (prefers-color-scheme and [data-theme])", () => {
  assert.equal(CSS_VARS.accent, "--ios-accent");
  assert.equal(CSS_VARS.gridline, "--ios-chart-grid");
  assert.equal(CSS_VARS.axis, "--ios-chart-axis");
  assert.equal(CSS_VARS.duration, "--ios-duration");
  assert.match(tokensCss, /prefers-color-scheme:\s*dark/);
  assert.match(tokensCss, /\[data-theme="dark"\]/);
  assert.match(tokensCss, new RegExp(`${CSS_VARS.accent}:\\s*${iosColor.light.accent}`, "i"));
  assert.match(tokensCss, /\[data-theme="dark"\][\s\S]*--ios-accent:\s*#0a84ff/i);
  assert.match(tokensCss, /@media \(prefers-color-scheme:\s*dark\)[\s\S]*--ios-accent:\s*#0a84ff/i);
});

test("type, radius and spacing map onto iosType / iosRadius / iosSpace", () => {
  assert.equal(typeScale.largeTitle, iosType.largeTitle);
  assert.equal(typeScale.headline, "1.0625rem");
  assert.equal(typeScale.caption1, "0.75rem");
  assert.equal(typeScale.caption2, "0.6875rem");
  assert.equal(radius.card, iosRadius.lg);
  assert.equal(radius.tooltip, iosRadius.md);
  assert.equal(radius.button, iosRadius.md);
  assert.equal(radius.chip, iosRadius.sm);
  assert.deepEqual(space, {
    4: iosSpace[1],
    8: iosSpace[2],
    12: iosSpace[3],
    16: iosSpace[4],
    20: iosSpace[5],
    24: iosSpace[6],
    32: iosSpace[7],
    gutter: iosSpace[4],
  });
  assert.equal(space.gutter, 16);
});

test("chart defaults: thin horizontal grid, few ticks, round 2.5px lines, phone heights", () => {
  assert.equal(CHART_HEIGHT[360], 200);
  assert.equal(CHART_HEIGHT[390], 216);
  assert.equal(grid.orientation, "horizontal");
  assert.equal(grid.vertical, false);
  assert.equal(grid.border, false);
  assert.ok(grid.minLines >= 3 && grid.maxLines <= 5);
  assert.ok(grid.strokeWidth <= 1);
  assert.equal(grid.color, "var(--ios-chart-grid)");
  assert.equal(axis.fontSize, iosType.caption1);
  assert.equal(axis.color, "var(--ios-chart-axis)");
  assert.equal(axis.fewTicks, true);
  assert.equal(line.strokeWidth, 2.5);
  assert.equal(line.lineCap, "round");
  assert.equal(line.areaFill, "var(--ios-chart-band)");
  assert.equal(tooltip.background, "var(--ios-background-elevated)");
  assert.equal(tooltip.shadow, "var(--ios-shadow-card)");
  assert.equal(tooltip.borderRadius, iosRadius.md);
  assert.equal(tooltip.value.fontSize, iosType.headline);
  assert.equal(tooltip.value.fontWeight, 600);
  assert.equal(tooltip.label.fontSize, iosType.caption1);
  assert.equal(tooltip.backdropBlurPx, TOOLTIP_BLUR_PX);
  // Shell chrome blurs through the material token; the token carries the px value.
  assert.match(shellCss, /blur\(var\(--ios-material-blur\)\)/);
  assert.match(tokensCss, new RegExp(`--ios-material-blur:\\s*${TOOLTIP_BLUR_PX}px`));
});

test("reduced motion turns chart animation off; duration matches --ios-duration", () => {
  assert.match(tokensCss, new RegExp(`--ios-duration:\\s*${CHART_MOTION_MS}ms`));
  assert.equal(chartMotionMs(true), 0);
  assert.equal(chartMotionMs(false), CHART_MOTION_MS);
  assert.ok(CHART_MOTION_MS > 0);
});

test("series use team colors when comparing teams, otherwise the accent", () => {
  assert.equal(seriesColor("light"), iosColor.light.accent);
  assert.equal(seriesColor("dark"), iosColor.dark.accent);
  assert.equal(seriesColor("light", { comparingTeams: true, teamColor: "#00338D" }), "#00338D");
  assert.equal(seriesColor("light", { comparingTeams: false, teamColor: "#00338D" }), iosColor.light.accent);
  assert.equal(seriesColor("dark", { comparingTeams: true }), iosColor.dark.accent);
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
