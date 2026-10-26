/** Game clocks shown to fans are quarter clocks (0:00–15:00), never half or game time. */
const QUARTER = 900;

function mmss(sec: number): string {
  const s = Math.max(0, Math.min(QUARTER, Math.floor(sec)));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** From nflverse game_seconds_remaining (3600 at kickoff, regulation only). */
export function quarterClockFromGame(quarter: number, gameSecondsRemaining: number): string {
  if (quarter > 4) return mmss(gameSecondsRemaining);
  return mmss(gameSecondsRemaining - (4 - quarter) * QUARTER);
}

/** From nflverse half_seconds_remaining (1800 at the start of Q1/Q3). OT passes through. */
export function quarterClockFromHalf(quarter: number, halfSecondsRemaining: number): string {
  if (quarter > 4) return mmss(halfSecondsRemaining);
  return mmss(quarter % 2 === 1 ? halfSecondsRemaining - QUARTER : halfSecondsRemaining);
}

export function periodName(quarter: number): string {
  return quarter > 4 ? "OT" : `Q${quarter}`;
}
