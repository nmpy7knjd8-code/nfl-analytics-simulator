/** Plain-football text helpers for Fourth & Daily screens (pure, tested). */
import type { QuizChoice } from "./quiz";

/** m:ss (kept local so the browser never loads the full quiz pack). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
import type { DailyItem } from "./daily";
import { teamNickname } from "./teams";
import { CLOSE_CALL_GAP, formatPercents, optionStates, rankedValues, type ScoredCall } from "./daily";

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

/** "A, B and C" serial list. */
export function listNames(n: string[]): string {
  return n.length < 2 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/**
 * QA M13 / 0015 P1-A: group options showing the same number.
 * "Kick and Go (both 91.9%) and Punt (90.8%)", "Go and Kick (24% vs 23%)" when nothing matches.
 */
export function groupedNames(names: string[], f: string[]): string {
  const groups: { names: string[]; pct: string }[] = [];
  names.forEach((n, i) => {
    const g = groups.find((x) => x.pct === f[i]);
    if (g) g.names.push(n);
    else groups.push({ names: [n], pct: f[i] });
  });
  if (groups.length === names.length) return `${listNames(names)} (${f.join(" vs ")})`;
  if (groups.length === 1) return `${listNames(names)} (${names.length === 2 ? "both" : "all"} ${f[0]})`;
  return groups
    .map((g) => `${listNames(g.names)} (${g.names.length === 1 ? "" : g.names.length === 2 ? "both " : "all "}${g.pct})`)
    .join(" and ");
}

export function pts(x: number): string {
  return `${(Math.abs(x) * 100).toFixed(1)} pts`;
}

/** One-sentence Why for the reveal, built only from the item's numbers (offered options only). */
export function whyText(item: DailyItem, scored: ScoredCall): string {
  const team = teamNickname(item.situation.posteam);
  const offered = new Set(optionStates(item).filter((o) => o.shown && !o.disabled).map((o) => o.id));
  const ranked = rankedValues(item).filter(([c]) => offered.has(c));
  const [best, bv] = ranked[0];
  if (ranked.length < 2) return `${CHOICE_NAME[best]} is the only option the model rates here.`;
  const [second, sv] = ranked[1];
  if (scored.closeCall) {
    // #96 / QA L7: only options within 2 points of the best are "about the same"; the rest are named as lower.
    const same = ranked.filter(([, v]) => bv - v < CLOSE_CALL_GAP);
    const worse = ranked.filter(([, v]) => bv - v >= CLOSE_CALL_GAP);
    const f = formatPercents(ranked.map(([, v]) => v));
    let t = `Close call for the ${team}: ${groupedNames(same.map(([c]) => CHOICE_NAME[c]), f.slice(0, same.length))} give about the same win chance`;
    if (worse.length) t += "; " + worse.map(([c], i) => `${CHOICE_NAME[c]} is lower (${f[same.length + i]})`).join(", ");
    return t + ".";
  }
  const [a, b] = formatPercents([bv, sv]);
  return `${CHOICE_NAME[best]} gives the ${team} the best chance to win: ${a} vs ${b} for ${CHOICE_NAME[second]}.`;
}

/** Points of win chance the pick cost vs the best option (0 if it was the best). */
export function cost(item: DailyItem, scored: ScoredCall): number {
  const best = rankedValues(item)[0][1];
  return best - (item.reveal.values[scored.pick] ?? 0);
}
