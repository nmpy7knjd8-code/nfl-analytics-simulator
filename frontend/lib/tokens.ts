/**
 * iOS design tokens — Fourth & Daily.
 *
 * Import path for NFL Charts UI (and any TS consumer):
 *   import { iosColor, iosChart, iosFonts, iosSpace, iosRadius, iosType, iosMetrics } from "@/lib/tokens";
 *
 * CSS source of the same tokens: frontend/app/tokens.css
 * Keep the two files in sync when a value changes.
 *
 * Accent (Head Grokka, Nov 10): #007AFF light, #0A84FF dark. One blue, used
 * everywhere. Charts use tints of that accent plus grays. Team colors are not
 * chrome tokens — they appear only on the scoreboard.
 *
 * Additive only: adopting these on a screen is a later, reviewable PR.
 * Do not use this module to change frozen daily data.
 */

export const iosFonts = {
  text: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, "Segoe UI", sans-serif',
  display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro", system-ui, "Segoe UI", sans-serif',
  mono: '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  nums: "tabular-nums",
} as const;

export const iosWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

export const iosColor = {
  light: {
    backgroundPrimary: "#f2f2f7",
    backgroundSecondary: "#ffffff",
    backgroundElevated: "#ffffff",
    backgroundGrouped: "#f2f2f7",
    backgroundGroupedSecondary: "#ffffff",
    labelPrimary: "#000000",
    labelSecondary: "#3c3c43",
    labelTertiary: "#636366",
    labelQuaternary: "rgba(60, 60, 67, 0.3)",
    labelOnAccent: "#ffffff",
    separator: "rgba(60, 60, 67, 0.18)",
    separatorOpaque: "#c6c6c8",
    fillPrimary: "rgba(120, 120, 128, 0.16)",
    fillSecondary: "rgba(120, 120, 128, 0.12)",
    fillTertiary: "rgba(120, 120, 128, 0.08)",
    accent: "#007aff",
    accentSoft: "color-mix(in srgb, var(--ios-accent) 12%, transparent)",
    red: "#ff3b30",
    navBackground: "rgba(242, 242, 247, 0.72)",
    tabBackground: "rgba(249, 249, 249, 0.78)",
    hairline: "rgba(0, 0, 0, 0.12)",
    shadowCard: "0 8px 28px rgba(0, 0, 0, 0.08)",
  },
  dark: {
    backgroundPrimary: "#000000",
    backgroundSecondary: "#1c1c1e",
    backgroundElevated: "#1c1c1e",
    backgroundGrouped: "#000000",
    backgroundGroupedSecondary: "#1c1c1e",
    labelPrimary: "#ffffff",
    labelSecondary: "rgba(235, 235, 245, 0.8)",
    labelTertiary: "#8e8e93",
    labelQuaternary: "rgba(235, 235, 245, 0.28)",
    labelOnAccent: "#ffffff",
    separator: "rgba(84, 84, 88, 0.65)",
    separatorOpaque: "#38383a",
    fillPrimary: "rgba(120, 120, 128, 0.32)",
    fillSecondary: "rgba(120, 120, 128, 0.24)",
    fillTertiary: "rgba(120, 120, 128, 0.16)",
    accent: "#0a84ff",
    accentSoft: "color-mix(in srgb, var(--ios-accent) 22%, transparent)",
    red: "#ff453a",
    navBackground: "rgba(22, 22, 24, 0.72)",
    tabBackground: "rgba(22, 22, 24, 0.78)",
    hairline: "rgba(255, 255, 255, 0.14)",
    shadowCard: "0 8px 28px rgba(0, 0, 0, 0.45)",
  },
} as const;

/** Resolved chart series (accent tints + gray) for canvas / SVG consumers. */
export const iosChart = {
  light: {
    axis: "rgba(60, 60, 67, 0.72)",
    grid: "rgba(60, 60, 67, 0.12)",
    // Mixes match tokens.css color-mix of the accent toward white / gray.
    series: ["#007aff", "#54a3ff", "#9bc4ff", "#8e8e93"] as const,
    band: "rgba(0, 122, 255, 0.14)",
  },
  dark: {
    axis: "rgba(235, 235, 245, 0.66)",
    grid: "rgba(84, 84, 88, 0.45)",
    series: ["#0a84ff", "#0757a8", "#06355f", "#8e8e93"] as const,
    band: "rgba(10, 132, 255, 0.22)",
  },
} as const;

export const iosType = {
  largeTitle: "2.125rem",
  largeTitleWeight: iosWeight.bold,
  title1: "1.75rem",
  title2: "1.375rem",
  title3: "1.25rem",
  headline: "1.0625rem",
  headlineWeight: iosWeight.semibold,
  body: "1.0625rem",
  callout: "1rem",
  subhead: "0.9375rem",
  footnote: "0.8125rem",
  caption1: "0.75rem",
  caption2: "0.6875rem",
  leadingTight: 1.12,
  leadingBody: 1.28,
  trackingLargeTitle: "-0.024em",
  trackingBody: "-0.018em",
} as const;

/** 4pt spacing grid, in pixels. */
export const iosSpace = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
} as const;

/** Corner radii, in pixels. Cards use lg (16); sheets use xl (20). */
export const iosRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const iosMaterial = {
  blur: "20px",
  saturate: "180%",
} as const;

export const iosMetrics = {
  navHeight: 44,
  tabHeight: 49,
  touch: 44,
} as const;

export type IosTheme = keyof typeof iosColor;

export function iosThemeColors(theme: IosTheme = "light") {
  return iosColor[theme];
}

export function iosChartColors(theme: IosTheme = "light") {
  return iosChart[theme];
}
