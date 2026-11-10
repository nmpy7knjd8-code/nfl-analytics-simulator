/**
 * The one place chart visuals come from.
 *
 * Values are derived from frontend/lib/tokens.ts and the --ios-* variables in
 * frontend/app/tokens.css (PR #325). Dark mode follows prefers-color-scheme
 * or [data-theme], already defined in tokens.css — this module does not
 * inject CSS or restyle existing charts.
 *
 * Import path: import { palettes, axis, grid, chartMotionMs } from "@/lib/chartStyle";
 */

import {
  iosChart,
  iosChartColors,
  iosColor,
  iosFonts,
  iosMetrics,
  iosRadius,
  iosSpace,
  iosThemeColors,
  iosType,
  type IosTheme,
} from "./tokens";

export type Theme = IosTheme;

export const FONT_STACK = iosFonts.text;

/** Chart numbers use tabular figures. */
export const NUMERIC_VARIANT = "tabular-nums" as const;

/** Semantic chart palette for a theme, mapped from iosColor / iosChart. */
export type Palette = {
  accent: string;
  label: string;
  secondaryLabel: string;
  separator: string;
  gridline: string;
  axis: string;
  background: string;
  groupedBackground: string;
  card: string;
  tooltip: string;
  band: string;
  series: readonly string[];
  shadow: string;
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? [...h].map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string, other: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(other);
  return rgbToHex(
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  );
}

/**
 * Series colors: steps of the accent blue, plus grays.
 * Never team colors, and never the orange / green / gold / purple token series.
 */
export function seriesStops(theme: Theme = "light"): readonly string[] {
  const accent = iosColor[theme].accent;
  return theme === "light"
    ? [accent, mix(accent, "#ffffff", 0.32), mix(accent, "#ffffff", 0.58), "#8e8e93", "#c7c7cc"]
    : [accent, mix(accent, "#ffffff", 0.28), mix(accent, "#ffffff", 0.52), "#8e8e93", "#636366"];
}

export const SERIES_CSS_VARS = [
  "--chart-series-1",
  "--chart-series-2",
  "--chart-series-3",
  "--chart-series-4",
  "--chart-series-5",
] as const;

export function seriesDeclarations(theme: Theme): string {
  return seriesStops(theme).map((c, i) => `${SERIES_CSS_VARS[i]}:${c}`).join(";");
}

/** Light defaults, dark via prefers-color-scheme or [data-theme]. Not injected globally. */
export function seriesColorSchemeCss(selector = ":root"): string {
  const nested = selector === ":root" ? "" : ` ${selector}`;
  return (
    `${selector}{${seriesDeclarations("light")}}` +
    `[data-theme="light"]${nested}{${seriesDeclarations("light")}}` +
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"])${nested}{${seriesDeclarations("dark")}}}` +
    `[data-theme="dark"]${nested}{${seriesDeclarations("dark")}}`
  );
}

export function palette(theme: Theme = "light"): Palette {
  const color = iosThemeColors(theme);
  const chart = iosChartColors(theme);
  return {
    accent: color.accent,
    label: color.labelPrimary,
    secondaryLabel: color.labelSecondary,
    separator: color.separator,
    gridline: chart.grid,
    axis: chart.axis,
    background: color.backgroundSecondary,
    groupedBackground: color.backgroundGrouped,
    card: color.backgroundElevated,
    tooltip: color.backgroundElevated,
    band: chart.band,
    series: seriesStops(theme),
    shadow: color.shadowCard,
  };
}

export const palettes: Record<Theme, Palette> = {
  light: palette("light"),
  dark: palette("dark"),
};

/** CSS variables already defined in tokens.css (light, dark via prefers-color-scheme or [data-theme]). */
export const CSS_VARS = {
  accent: "--ios-accent",
  label: "--ios-label-primary",
  secondaryLabel: "--ios-label-secondary",
  separator: "--ios-separator",
  gridline: "--ios-chart-grid",
  axis: "--ios-chart-axis",
  background: "--ios-background-secondary",
  groupedBackground: "--ios-background-grouped",
  card: "--ios-background-elevated",
  tooltip: "--ios-background-elevated",
  band: "--ios-chart-band",
  shadow: "--ios-shadow-card",
  font: "--ios-font-text",
  caption: "--ios-text-caption-1",
  headline: "--ios-text-headline",
  duration: "--ios-duration",
} as const;

export const typeScale = iosType;

export const radius = {
  card: iosRadius.lg,
  tooltip: iosRadius.md,
  button: iosRadius.md,
  chip: iosRadius.sm,
} as const;

export const space = {
  4: iosSpace[1],
  8: iosSpace[2],
  12: iosSpace[3],
  16: iosSpace[4],
  20: iosSpace[5],
  24: iosSpace[6],
  32: iosSpace[7],
  gutter: iosSpace[4],
} as const;

export const TAP_TARGET_MIN = iosMetrics.touch;

/** Chart plot height in px at the two phone widths we screenshot. */
export const CHART_HEIGHT = {
  360: 200,
  390: 216,
} as const;

/** Axis labels: caption 1 in the chart axis color, few ticks. */
export const axis = {
  fontSize: iosType.caption1,
  color: `var(${CSS_VARS.axis})`,
  fewTicks: true,
  maxTicks: 5,
} as const;

/** Horizontal gridlines only, thin and low-contrast; no vertical grid, no border. */
export const grid = {
  orientation: "horizontal",
  minLines: 3,
  maxLines: 5,
  vertical: false,
  border: false,
  strokeWidth: 1,
  color: `var(${CSS_VARS.gridline})`,
} as const;

/** Series lines: 2.5px with round caps; optional area fill uses the chart band token. */
export const line = {
  strokeWidth: 2.5,
  lineCap: "round",
  lineJoin: "round",
  areaFill: `var(${CSS_VARS.band})`,
} as const;

/** Backdrop blur matches the opt-in shell chrome in ios-shell.css. */
export const TOOLTIP_BLUR_PX = 20;

/** Tooltip: headline-weight value, caption label, card radius, card shadow. */
export const tooltip = {
  background: `var(${CSS_VARS.tooltip})`,
  backdropBlurPx: TOOLTIP_BLUR_PX,
  borderRadius: radius.tooltip,
  shadow: `var(${CSS_VARS.shadow})`,
  value: { fontSize: iosType.headline, fontWeight: 600 },
  label: { fontSize: iosType.caption1, fontWeight: 400 },
} as const;

/** Matches --ios-duration in tokens.css. */
export const CHART_MOTION_MS = 220;

/** Animation is off when the user prefers reduced motion. */
export function chartMotionMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : CHART_MOTION_MS;
}

/**
 * Series color by step (0 = accent, then lighter blue tints, then grays).
 * Never uses team colors.
 */
export function seriesColor(theme: Theme, index = 0): string {
  const stops = seriesStops(theme);
  return stops[index] ?? stops[0];
}

export { iosChart, iosColor, iosFonts, iosMetrics, iosRadius, iosSpace, iosType };
