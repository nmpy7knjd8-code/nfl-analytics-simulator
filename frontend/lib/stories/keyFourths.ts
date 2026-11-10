import { shownDelta } from "./swings";
/**
 * C1 Pause, Phase-1 rule: a regulation 4th down where the real call swung the
 * chance to win 10+ points. Plays in the last 5 seconds of a half are skipped.
 * Overtime is never included (no win chance in OT).
 */
export type KeyRow = {
  play_id: number; qtr: number; clock: string | null; posteam: string | null; down: number | null;
  ydstogo: number | null; yardline_100?: number | null; play_type: string | null;
  home_wp: number | null; home_wp_after: number | null;
};
export type KeyFourth = { playId: number; qtr: number; clock: string; team: string; togo: number; yardline: number | null; call: "go" | "punt" | "fg"; swing: number; toward: string };

const secs = (c: string) => { const [m, s] = c.split(":").map(Number); return m * 60 + s; };

export function callOf(pt: string | null): KeyFourth["call"] | null {
  if (pt === "pass" || pt === "run") return "go";
  if (pt === "punt") return "punt";
  if (pt === "field_goal") return "fg";
  return null;
}

export function keyFourths(rows: KeyRow[], home: string, away: string, min = 0.1): KeyFourth[] {
  const out: KeyFourth[] = [];
  for (const r of rows) {
    if (r.down !== 4 || r.qtr < 1 || r.qtr > 4 || !r.clock || !r.posteam || r.ydstogo == null) continue;
    if (r.home_wp == null || r.home_wp_after == null) continue;
    if ((r.qtr === 2 || r.qtr === 4) && secs(r.clock) <= 5) continue;
    const call = callOf(r.play_type);
    if (!call) continue;
    const d = r.home_wp_after - r.home_wp;
    if (Math.abs(d) < min) continue;
    out.push({ playId: r.play_id, qtr: r.qtr, clock: r.clock.replace(/^0(\d)/, "$1"), team: r.posteam, togo: r.ydstogo, yardline: r.yardline_100 ?? null, call, swing: Math.abs(shownDelta(r.home_wp, r.home_wp_after)), toward: d > 0 ? home : away });
  }
  return out;
}

/** "own 34" / "opp 12" / "midfield" from yards to the end zone. */
export function spot(team: string, yl: number | null): string {
  if (yl == null) return "";
  if (yl === 50) return "midfield";
  return yl > 50 ? `own ${100 - yl}` : `opponent's ${yl}`;
}

/** Phrase after "4th and N": "at their own 34", "at the opponent's 12", "at midfield". */
export function atSpot(at: string): string {
  if (!at) return "";
  if (at === "midfield") return " at midfield";
  if (at.startsWith("own ")) return ` at their ${at}`;
  return ` at the ${at}`;
}

export const CALL_LABEL: Record<KeyFourth["call"], string> = { go: "Went for it", punt: "Punted", fg: "Kicked a field goal" };
