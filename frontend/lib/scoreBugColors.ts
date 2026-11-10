/**
 * Panel colors for the TV score bug on /games/[id].
 * Team colors appear only here: each side is filled with a team color,
 * ink meets WCAG AA (4.5:1), and a fallback is used when the two
 * backgrounds would clash.
 */
import teamColors from "./teamColors.json";
import { currentTeam } from "./teamCodes";

export type Panel = { bg: string; ink: "#FFFFFF" | "#000000" };

type Swatch = { primary: string; secondary: string; tertiary: string };

const TEAMS = (teamColors as { teams: Record<string, Swatch> }).teams;

const WHITE = "#FFFFFF" as const;
const BLACK = "#000000" as const;
const AA = 4.5;
/** Two panels need at least this much contrast to read as separate sides. */
const CLASH = 2;

export function teamSwatch(abbr: string): Swatch {
  return TEAMS[currentTeam(abbr)] ?? { primary: "#111111", secondary: "#666666", tertiary: "#FFFFFF" };
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLin) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [l1, l2] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

export function inkOn(bg: string): typeof WHITE | typeof BLACK {
  return contrastRatio(bg, WHITE) >= contrastRatio(bg, BLACK) ? WHITE : BLACK;
}

function mix(hex: string, toward: string, t: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(toward);
  return rgbToHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

export function normalizeHex(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r, g, b);
}

/** Keep the team hue when we can; mix toward black or white until ink meets AA. */
export function ensureAA(bg: string): Panel {
  const base = normalizeHex(bg);
  const ink = inkOn(base);
  if (contrastRatio(base, ink) >= AA) return { bg: base, ink };
  const other = ink === WHITE ? BLACK : WHITE;
  if (contrastRatio(base, other) >= AA) return { bg: base, ink: other };
  const target = ink === WHITE ? BLACK : WHITE;
  let cur = base;
  for (let t = 0.08; t <= 1; t += 0.08) {
    cur = mix(base, target, t);
    if (contrastRatio(cur, ink) >= AA) return { bg: cur, ink };
  }
  return { bg: target, ink };
}

function candidates(s: Swatch): string[] {
  return [s.primary, s.secondary, s.tertiary];
}

/**
 * Away and home panels for the score bug. Prefers each team's primary,
 * then other official colors, then a black/white panel so the sides stay distinct.
 */
export function scoreBugPanels(away: string, home: string): { away: Panel; home: Panel } {
  const aS = teamSwatch(away);
  const hS = teamSwatch(home);
  const pairs: [string, string][] = [];
  for (const a of candidates(aS)) {
    for (const h of candidates(hS)) pairs.push([a, h]);
  }
  // Prefer both primaries first (already first in the loop).
  for (const [a, h] of pairs) {
    const A = ensureAA(a);
    const H = ensureAA(h);
    if (A.bg !== H.bg && contrastRatio(A.bg, H.bg) >= CLASH) return { away: A, home: H };
  }
  const A = ensureAA(aS.primary);
  const fallback = contrastRatio(A.bg, BLACK) >= CLASH ? ensureAA(BLACK) : ensureAA(WHITE);
  if (fallback.bg === A.bg) {
    const other = A.bg === BLACK ? ensureAA(WHITE) : ensureAA(BLACK);
    return { away: A, home: other };
  }
  return { away: A, home: fallback };
}
