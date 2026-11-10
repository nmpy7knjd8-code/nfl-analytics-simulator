/**
 * The one place chart visuals come from.
 *
 * Not imported by existing chart components yet, so the live look is unchanged.
 * Values are provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET.
 */

/** provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const TOKEN_SOURCE =
  "provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET";

/** provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif";

/** provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const NUMERIC_VARIANT = "tabular-nums" as const;

export type Theme = "light" | "dark";

export type Palette = {
  accent: string;
  label: string;
  secondaryLabel: string;
  separator: string;
  gridline: string;
  background: string;
  groupedBackground: string;
  card: string;
  tooltip: string;
};

/**
 * Gridline is the separator color at about 50% opacity.
 * provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET
 */
export const palettes: Record<Theme, Palette> = {
  light: {
    accent: "#007AFF",
    label: "#000",
    secondaryLabel: "rgba(60,60,67,0.6)",
    separator: "rgba(60,60,67,0.29)",
    gridline: "rgba(60,60,67,0.145)",
    background: "#FFF",
    groupedBackground: "#F2F2F7",
    card: "#FFF",
    tooltip: "rgba(255,255,255,0.85)",
  },
  dark: {
    accent: "#0A84FF",
    label: "#FFF",
    secondaryLabel: "rgba(235,235,245,0.6)",
    separator: "rgba(84,84,88,0.65)",
    gridline: "rgba(84,84,88,0.325)",
    background: "#000",
    groupedBackground: "#000",
    card: "#1C1C1E",
    tooltip: "rgba(44,44,46,0.85)",
  },
};

/** CSS custom properties. This module does not inject them into the live site. */
export const CSS_VARS = {
  accent: "--chart-accent",
  label: "--chart-label",
  secondaryLabel: "--chart-secondary-label",
  separator: "--chart-separator",
  gridline: "--chart-gridline",
  background: "--chart-background",
  groupedBackground: "--chart-grouped-background",
  card: "--chart-card",
  tooltip: "--chart-tooltip",
} as const;

export function cssVarDeclarations(theme: Theme): string {
  const p = palettes[theme];
  return (
    `${CSS_VARS.accent}:${p.accent};` +
    `${CSS_VARS.label}:${p.label};` +
    `${CSS_VARS.secondaryLabel}:${p.secondaryLabel};` +
    `${CSS_VARS.separator}:${p.separator};` +
    `${CSS_VARS.gridline}:${p.gridline};` +
    `${CSS_VARS.background}:${p.background};` +
    `${CSS_VARS.groupedBackground}:${p.groupedBackground};` +
    `${CSS_VARS.card}:${p.card};` +
    `${CSS_VARS.tooltip}:${p.tooltip}`
  );
}

/** Light defaults, dark via prefers-color-scheme. Not applied to the live site. */
export function colorSchemeCss(): string {
  return (
    `:root{${cssVarDeclarations("light")}}` +
    `@media (prefers-color-scheme:dark){:root{${cssVarDeclarations("dark")}}}`
  );
}

export type TypeStyle = {
  fontSize: number;
  lineHeight?: number;
  fontWeight: number;
};

/** Type scale in px. provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const typeScale = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: 700 },
  title: { fontSize: 28, fontWeight: 700 },
  title2: { fontSize: 22, fontWeight: 700 },
  title3: { fontSize: 20, fontWeight: 700 },
  headline: { fontSize: 17, fontWeight: 600 },
  body: { fontSize: 17, fontWeight: 400 },
  subhead: { fontSize: 15, fontWeight: 400 },
  footnote: { fontSize: 13, fontWeight: 400 },
  caption: { fontSize: 12, fontWeight: 400 },
  caption2: { fontSize: 11, fontWeight: 400 },
} as const satisfies Record<string, TypeStyle>;

/** Radius in px. provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const radius = {
  card: 16,
  tooltip: 12,
  button: 12,
  chip: 8,
} as const;

/** Spacing in px. provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const space = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  gutter: 16,
} as const;

/** Phone-first sizing. provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const TAP_TARGET_MIN = 44;

/** Chart plot height in px at the two phone widths we screenshot. */
export const CHART_HEIGHT = {
  360: 200,
  390: 216,
} as const;

/** Axis labels: caption 12 in secondaryLabel, few ticks. */
export const axis = {
  fontSize: typeScale.caption.fontSize,
  fontWeight: typeScale.caption.fontWeight,
  color: "secondaryLabel",
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
  color: "gridline",
} as const;

/** Series lines: 2.5px with round caps; area fill optional and light. */
export const line = {
  strokeWidth: 2.5,
  lineCap: "round",
  lineJoin: "round",
  areaFillOpacity: 0.16,
} as const;

/**
 * Tooltip: value in headline weight, caption label, rounded, 20px backdrop blur, soft shadow.
 * provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET
 */
export const tooltip = {
  backdropBlurPx: 20,
  borderRadius: radius.tooltip,
  shadow: "0 8px 24px rgba(0,0,0,0.12)",
  value: { fontSize: typeScale.headline.fontSize, fontWeight: typeScale.headline.fontWeight },
  label: { fontSize: typeScale.caption.fontSize, fontWeight: typeScale.caption.fontWeight },
} as const;

/** Default motion duration in ms. provisional (iOS Designer, Nov 10); final names in designer PR ~5 AM ET */
export const CHART_MOTION_MS = 240;

/** Animation is off when the user prefers reduced motion. */
export function chartMotionMs(prefersReducedMotion: boolean): number {
  return prefersReducedMotion ? 0 : CHART_MOTION_MS;
}

/**
 * Series color: team colors when comparing teams, otherwise the theme accent
 * (iOS blue in this module, not the live --sg-b).
 */
export function seriesColor(
  theme: Theme,
  opts: { comparingTeams?: boolean; teamColor?: string | null } = {},
): string {
  if (opts.comparingTeams && opts.teamColor) return opts.teamColor;
  return palettes[theme].accent;
}
