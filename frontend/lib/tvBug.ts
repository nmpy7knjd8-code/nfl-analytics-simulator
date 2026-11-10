import colors from "./teamColors.json";
import { currentTeam } from "./teamCodes";

/** WCAG relative luminance of a #rrggbb color. */
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => p - q);
  return (y + 0.05) / (x + 0.05);
}

export type Panel = { bg: string; ink: string };
/** Neutral panel when a team color can't be used (white ink, 11.7:1). */
export const NEUTRAL_PANEL = "#3a3a3c";
/** Clash fallbacks after the home team's secondary color: dark gray, mid gray, light gray (black ink). */
const NEUTRALS = [NEUTRAL_PANEL, "#636366", "#c7c7cc"];
const AA = 4.5;

const teamColors = (abbr: string) =>
  (colors as { teams: Record<string, { primary: string; secondary: string }> }).teams[currentTeam(abbr)];

/** White or black ink, whichever passes AA (white preferred); null when neither does. */
function inkFor(bg: string): string | null {
  if (contrast(bg, "#ffffff") >= AA) return "#ffffff";
  if (contrast(bg, "#000000") >= AA) return "#000000";
  return null;
}

const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
/** Two panel colors "clash" when they are too close to tell apart side by side (RGB distance under 80). */
export function clashes(a: string, b: string): boolean {
  const [p, q] = [rgb(a), rgb(b)];
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) < 80;
}

/** One team's panel: its nflverse primary with AA ink, else neutral. */
export function teamPanel(abbr: string): Panel {
  const bg = teamColors(abbr)?.primary;
  const ink = bg ? inkFor(bg) : null;
  return bg && ink ? { bg, ink } : { bg: NEUTRAL_PANEL, ink: "#ffffff" };
}

/**
 * Both halves of the TV score bug. Each team gets its primary color with white or black ink at 4.5:1 or
 * better. When the two clash (e.g. NE and SEA are both #002244), the home team switches to its secondary
 * color if that passes AA and doesn't clash, otherwise to the first neutral gray that doesn't. lib/tvBug.test.ts checks every pairing.
 */
export function teamPanels(away: string, home: string): { away: Panel; home: Panel } {
  const a = teamPanel(away);
  const h = teamPanel(home);
  if (!clashes(a.bg, h.bg)) return { away: a, home: h };
  const sec = teamColors(home)?.secondary;
  const options: string[] = [...(sec ? [sec] : []), ...NEUTRALS];
  for (const bg of options) {
    const ink = inkFor(bg);
    if (ink && !clashes(a.bg, bg)) return { away: a, home: { bg, ink } };
  }
  return { away: a, home: { bg: NEUTRAL_PANEL, ink: "#ffffff" } };
}
