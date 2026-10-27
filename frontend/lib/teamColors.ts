/**
 * Team identity colors (approved exception to the one-accent rule). Source: lib/teamColors.json (#90, nflverse).
 * Used only as thin borders/stripes, chart lines, small chips and faint header tints. No logos or marks;
 * abbreviations are always shown. `tertiary` is optional until Data & Models adds it.
 */
import teamColorsJson from "./teamColors.json";

export interface TeamColorSet {
  primary: string;
  secondary: string;
  tertiary?: string;
}
const TEAMS = (teamColorsJson as unknown as { teams: Record<string, TeamColorSet> }).teams;

export function teamColorSet(abbr: string): TeamColorSet | null {
  return TEAMS[abbr] ?? null;
}

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** WCAG 2.x contrast ratio. */
export function contrast(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Redmean color distance (0..~765). Below CLASH the two lines read as one color. */
export function colorDistance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}
export const CLASH = 120;

/** State colors team identity must not imitate (accent/recommended, good, bad). */
export const STATE_COLORS = ["#2563EB", "#16A34A", "#DC2626"];

/** Low-saturation (black/grey/white) colors don't identify a team. */
export function isNeutral(hex: string): boolean {
  const [r, g, b] = rgb(hex);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn < 40;
}

/**
 * The team's own colors in fallback order: primary, secondary, then tertiary (#92). Tertiary can duplicate
 * another color (NYJ, TEN, CHI) or be neutral (9 teams; see _tertiary_notes), so duplicates are dropped
 * and a neutral tertiary is skipped.
 */
export function candidates(abbr: string): string[] {
  const s = teamColorSet(abbr);
  if (!s) return [];
  const out: string[] = [];
  for (const [i, c] of [s.primary, s.secondary, s.tertiary].entries()) {
    if (!c) continue;
    const u = c.toUpperCase();
    if (out.includes(u)) continue;
    if (i === 2 && isNeutral(u)) continue;
    out.push(u);
  }
  return out;
}

export interface MatchupColors {
  home: string | null;
  away: string | null;
  /** True when every away color clashes with home: away keeps its primary as a thin accent, drawn dashed. */
  awayDashed: boolean;
}

/**
 * Home keeps its primary; the away team switches to its secondary, then tertiary, when it clashes with home.
 * Always one of the team's own colors. If all clash, the away line is dashed (abbreviations always shown).
 */
export function matchupColors(home: string, away: string): MatchupColors {
  const h = candidates(home)[0] ?? null;
  const ac = candidates(away);
  if (!h || !ac.length) return { home: h, away: ac[0] ?? null, awayDashed: false };
  const a = ac.find((c) => colorDistance(c, h) >= CLASH);
  return a ? { home: h, away: a, awayDashed: false } : { home: h, away: ac[0], awayDashed: true };
}

/** Text color on a team-color fill: white or near-black, whichever passes AA (4.5:1); one always does. */
export const INK_LIGHT = "#FFFFFF";
export const INK_DARK = "#111111";
export function textOn(fill: string): string {
  return contrast(fill, INK_LIGHT) >= contrast(fill, INK_DARK) ? INK_LIGHT : INK_DARK;
}

/** Faint tint for matchup headers. */
export function tint(hex: string, alpha = 0.08): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
