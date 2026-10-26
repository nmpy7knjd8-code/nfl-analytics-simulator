/** Plain-football text helpers for Fourth & Daily screens (pure, tested). */
import type { QuizChoice } from "./quiz";

/** m:ss (kept local so the browser never loads the full quiz pack). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
import type { DailyItem } from "./daily";
import { teamNickname } from "./teams";
import { rankedValues, type ScoredCall } from "./daily";

export const CHOICE_NAME: Record<QuizChoice, string> = { go: "Go", fg: "Kick", punt: "Punt" };

/** "at KC 38" / "at own 25" style spot, from the offense's view. */
export function spotText(item: DailyItem): string {
  const yl = Math.round(item.situation.yardline_100);
  if (yl === 50) return "at midfield";
  return yl < 50 ? `at ${item.situation.defteam} ${yl}` : `at own ${100 - yl}`;
}

export function periodText(q: number): string {
  return q > 4 ? "OT" : `Q${q}`;
}

/** "DET 17 – KC 14 · Q4 2:31 · 4th & 2 at KC 38" (offense first). */
export function scoreboardText(item: DailyItem): string {
  const s = item.situation;
  return `${s.posteam} ${s.posteam_score} – ${s.defteam} ${s.defteam_score} · ${periodText(s.qtr)} ${formatClock(
    s.quarter_seconds_remaining,
  )} · 4th & ${s.distance} ${spotText(item)}`;
}

/** "LAC @ DEN · 2022 Week 18 · Jan 8, 2023" from the real game. */
export function gameText(item: DailyItem): string {
  const s = item.situation;
  const parts = [`${s.away_team} @ ${s.home_team}`];
  if (item.source.season && item.source.week) parts.push(`${item.source.season} Week ${item.source.week}`);
  if (item.source.game_date) {
    const [y, m, d] = item.source.game_date.split("-").map(Number);
    parts.push(new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }));
  }
  return parts.join(" · ");
}

export function pts(x: number): string {
  return `${(Math.abs(x) * 100).toFixed(1)} pts`;
}

/** One-sentence Why for the reveal, built only from the item's numbers. */
export function whyText(item: DailyItem, scored: ScoredCall): string {
  const team = teamNickname(item.situation.posteam);
  const ranked = rankedValues(item);
  const [best, bv] = ranked[0];
  if (ranked.length < 2) return `${CHOICE_NAME[best]} is the only option the model rates here.`;
  const [second, sv] = ranked[1];
  if (scored.closeCall)
    return `Close call: ${CHOICE_NAME[best]} and ${CHOICE_NAME[second]} are within ${pts(bv - sv)} of each other for the ${team}, so either is reasonable.`;
  return `${CHOICE_NAME[best]} gives the ${team} the best chance to win: ${Math.round(bv * 100)}% vs ${Math.round(sv * 100)}% for ${CHOICE_NAME[second]}.`;
}

/** Points of win chance the pick cost vs the best option (0 if it was the best). */
export function cost(item: DailyItem, scored: ScoredCall): number {
  const best = rankedValues(item)[0][1];
  const mine = rankedValues(item).find(([id]) => id === scored.pick)?.[1];
  return mine == null ? 0 : best - mine;
}
