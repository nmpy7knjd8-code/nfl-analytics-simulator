/**
 * The one place chart visuals come from.
 *
 * Values are derived from frontend/lib/tokens.ts and the --ios-* variables in
 * frontend/app/tokens.css (PR #325). Dark mode follows prefers-color-scheme
 * or [data-theme], already defined in tokens.css — this module does not
 * inject CSS or restyle existing charts.
 *
 * Chart series follow tokens v2 (#338): accent-blue tints plus gray #8E8E93,
 * never team colors or the #325 orange/green/gold/purple series. Until #338
 * lands, seriesStops uses the same resolved hexes as iosChart.series in that
 * PR so this branch does not pick up the colorful #325 palette.
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

/** Chart numbers use tabular figures (iosFonts.nums / --ios-nums in tokens v2). */
export const NUMERIC_VARIANT = "tabular-nums" as const;

/** Backdrop and typography weights from tokens v2 (#338). Local until that PR lands. */
export const MATERIAL = {
  blur: "20px",
  saturate: "180%",
} as const;

export const WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

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

/** Resolved series from tokens v2 (#338): accent + two tints + gray. */
const TOKENS_V2_SERIES = {
  light: ["#007aff", "#54a3ff", "#9bc4ff", "#8e8e93"],
  dark: ["#0a84ff", "#0757a8", "#06355f", "#8e8e93"],
} as const;

const COLORFUL_SERIES = /#34c759|#ff9f0a|#af52de|#30d158|#ffd60a|#bf5af2/i;

function isBlueGraySeries(series: readonly string[]): boolean {
  return (
    series.length >= 4 &&
    /^#8e8e93$/i.test(series[series.length - 1] ?? "") &&
    series.every((c) => !COLORFUL_SERIES.test(c))
  );
}

/**
 * Series colors: accent-blue tints plus gray #8E8E93, matching iosChart.series
 * in tokens v2 (#338). Never team colors, and never the #325 colorful series.
 * Prefers the token export once it is already blue+gray; otherwise the v2 hexes.
 */
export function seriesStops(theme: Theme = "light"): readonly string[] {
  const official = iosChart[theme].series as readonly string[];
  if (isBlueGraySeries(official)) return official;
  return TOKENS_V2_SERIES[theme];
}

export const SERIES_CSS_VARS = [
  "--chart-series-1",
  "--chart-series-2",
  "--chart-series-3",
  "--chart-series-4",
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
  nums: "--ios-nums",
  materialBlur: "--ios-material-blur",
  materialSaturate: "--ios-material-saturate",
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

/** Backdrop blur matches tokens v2 iosMaterial.blur and ios-shell.css. */
export const TOOLTIP_BLUR_PX = parseInt(MATERIAL.blur, 10);

/** Tooltip: headline-weight value, caption label, card radius, card shadow. */
export const tooltip = {
  background: `var(${CSS_VARS.tooltip})`,
  backdropBlurPx: TOOLTIP_BLUR_PX,
  backdropSaturate: MATERIAL.saturate,
  borderRadius: radius.tooltip,
  shadow: `var(${CSS_VARS.shadow})`,
  value: { fontSize: iosType.headline, fontWeight: WEIGHT.semibold },
  label: { fontSize: iosType.caption1, fontWeight: WEIGHT.regular },
} as const;

/** Matches --ios-duration in tokens.css. */
export const CHART_MOTION_MS = 220;

/** Animation is off when the user prefers reduced motion. */
export function chartMotionMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : CHART_MOTION_MS;
}

/**
 * Series color by step (0 = accent, then tints, then gray #8E8E93).
 * Never uses team colors.
 */
export function seriesColor(theme: Theme, index = 0): string {
  const stops = seriesStops(theme);
  return stops[index] ?? stops[0];
}

export { iosChart, iosColor, iosFonts, iosMetrics, iosRadius, iosSpace, iosType };
