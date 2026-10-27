/**
 * Fourth & Daily simple game (Direction B v2, approved by Garrett 10-27): pure helpers for the
 * score bug, the top-down field and the reveal. No model win chances are shown on these screens;
 * values are only used for grading through scoreCall (#124: ties at the shown % are Right).
 */
import type { QuizChoice } from "./quiz";
import { formatPercents, optionStates, rankedValues, CLOSE_CALL_GAP, type DailyItem, type ScoredCall } from "./daily";
import type { GameFileV2 } from "./gameFileV2";

export const CHOICE_LABEL: Record<QuizChoice, string> = { go: "Go for it", fg: "Field goal", punt: "Punt" };
const BEST_PHRASE: Record<QuizChoice, string> = { go: "going for it", fg: "the field goal", punt: "punting" };
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** Options a fan can tap: Kick is gone (not just disabled) past 64 yd, Punt hidden inside the 35. */
export function tappable(item: DailyItem): { id: QuizChoice; detail?: string }[] {
  return optionStates(item)
    .filter((o) => o.shown && !o.disabled)
    .map((o) => (o.id === "fg" ? { id: o.id, detail: `${Math.round(item.situation.yardline_100 + 18)} yd` } : { id: o.id }));
}

export function kickTooFar(item: DailyItem): boolean {
  return !optionStates(item).some((o) => o.id === "fg" && o.shown && !o.disabled);
}

/** "MIDFIELD", "OWN 42", "BAL 16". */
export function spotText(item: DailyItem): string {
  const yl = item.situation.yardline_100;
  if (yl === 50) return "MIDFIELD";
  return yl > 50 ? `OWN ${100 - yl}` : `${item.situation.defteam} ${yl}`;
}

export function isGoalToGo(item: DailyItem): boolean {
  return item.situation.distance >= item.situation.yardline_100;
}

/** Score-bug flag row: "4th & 6 · BAL 16", "4th & Goal · TB 11". */
export function flagText(item: DailyItem): string {
  return `4th & ${isGoalToGo(item) ? "Goal" : item.situation.distance} · ${spotText(item)}`;
}

export function clockText(item: DailyItem): string {
  const s = item.situation.quarter_seconds_remaining;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Tags for the offered options only (QA N9: nothing for options that weren't offered). */
export type OptionTag = { id: QuizChoice; tag: "Best" | "Close call · ½ point" | null };
export function optionTags(item: DailyItem, scored: ScoredCall): OptionTag[] {
  const offered = tappable(item).map((o) => o.id);
  const ranked = rankedValues(item).filter(([c]) => offered.includes(c));
  const f = formatPercents(ranked.map(([, v]) => v));
  const at = (c: QuizChoice) => f[ranked.findIndex(([x]) => x === c)];
  const bestV = scored.values[scored.best] ?? 0;
  return ranked.map(([id, v]) => {
    if (at(id) === at(scored.best)) return { id, tag: "Best" as const };
    if (scored.closeCall && bestV - v < CLOSE_CALL_GAP) return { id, tag: "Close call · ½ point" as const };
    return { id, tag: null };
  });
}

/** Plain best-call sentence, no numbers. */
export function bestCallText(tags: OptionTag[]): string {
  const best = tags.filter((t) => t.tag === "Best").map((t) => BEST_PHRASE[t.id]);
  const close = tags.filter((t) => t.tag === "Close call · ½ point").map((t) => BEST_PHRASE[t.id]);
  if (best.length > 1) return `${cap(best.slice(0, -1).join(", "))} and ${best[best.length - 1]} were equally good. Both count.`;
  if (close.length) return `${cap(best[0])} was the best call, and ${close.join(" and ")} was close behind.`;
  return `${cap(best[0])} was the best call.`;
}

export const RESULT_TITLE = { right: "Correct", close: "Close call", wrong: "Not this time" } as const;
export const RESULT_GLYPH = { right: "✓", close: "½", wrong: "✕" } as const;

/** What really happened, from the live game file (approved path: /data/games/<id>.json, games-v3). */
export type Outcome = {
  /** Plain-English play sentence (display_text only; never raw desc). Null when the file lacks it. */
  text: string | null;
  /** Offense-frame yards from the opponent's goal where the ball ended; -7 = through the uprights. */
  endYardline100: number;
  label: string;
  /** "The Eagles won 22–16." */
  finalText: string | null;
};

const NON_PLAY = /^(GAME|END (QUARTER \d|GAME)|Two-Minute Warning|Timeout #\d)/i;

export function outcomeFromGame(doc: GameFileV2, item: DailyItem, nick: (abbr: string) => string): Outcome | null {
  const playId = Number(item.id.split("-").pop());
  const c = doc.cols;
  const i = c.play_id.indexOf(playId);
  if (i < 0) return null;
  const pos = item.situation.posteam;
  const yl = item.situation.yardline_100;
  const type = c.play_type[i];
  const raw = c.text[i] ?? "";
  const text = c.display_text?.[i]?.trim() || null;
  let j = i + 1;
  while (j < c.play_id.length && (c.play_type[j] == null || NON_PLAY.test(c.text[j] ?? ""))) j++;
  // A kickoff next (half ended, or a score) says nothing about where this ball was downed.
  const next = j < c.play_id.length && c.play_type[j] !== "kickoff" ? j : -1;
  const isHome = doc.game.home === pos;
  const scoreOf = (k: number) => (k < 0 ? null : isHome ? c.home_score[k] : c.away_score[k]);
  const before = item.situation.posteam_score;
  const after = scoreOf(i) ?? before;
  let end = yl;
  let label: string;
  if (type === "field_goal") {
    const good = /field goal is GOOD/i.test(raw);
    end = good ? -7 : yl;
    const yds = (text ?? raw).match(/(\d+)[- ]yard field goal/i)?.[1] ?? String(Math.round(yl + 18));
    label = good ? `${yds}-yd FG · good` : "Field goal missed";
  } else if (type === "punt") {
    end = next >= 0 && c.posteam[next] !== pos && c.yardline_100[next] != null ? 100 - (c.yardline_100[next] as number) : yl;
    label = "Punted";
  } else if ((after ?? 0) - (before ?? 0) >= 6) {
    end = 0;
    label = "Touchdown";
  } else if (next >= 0 && c.posteam[next] === pos && c.yardline_100[next] != null) {
    end = c.yardline_100[next] as number;
    label = c.down[next] === 1 ? `First down · ${end === 50 ? "midfield" : end > 50 ? `own ${100 - end}` : `${item.situation.defteam} ${end}`}` : "Short";
  } else {
    end = next >= 0 && c.yardline_100[next] != null ? 100 - (c.yardline_100[next] as number) : yl;
    label = "Turnover on downs";
  }
  end = Math.max(-7, Math.min(100, end));
  const g = doc.game as { home: string; away: string; home_score?: number; away_score?: number };
  let finalText: string | null = null;
  if (typeof g.home_score === "number" && typeof g.away_score === "number") {
    const [w, wl, ws, ls] = g.home_score >= g.away_score ? [g.home, g.away, g.home_score, g.away_score] : [g.away, g.home, g.away_score, g.home_score];
    finalText = ws === ls ? `It ended in a ${ws}–${ls} tie.` : `The ${nick(w)} won ${ws}–${ls}.`;
    void wl;
  }
  return { text, endYardline100: end, label, finalText };
}

/** Coach line: "Went for it.", "Kicked a field goal.", "Punted." */
export function coachCallText(item: DailyItem): string {
  const a = item.historical_action;
  return a === "go" ? "Went for it." : a === "fg" ? "Kicked a field goal." : a === "punt" ? "Punted." : "";
}

/** Spoiler-free share text, plain glyphs only (no colored emoji). */
export function plainShare(dayNo: number, results: ScoredCall["result"][], credit: string, streak: number): string {
  const g = results.map((r) => RESULT_GLYPH[r]).join(" ");
  return `Fourth & Daily #${dayNo} · ${credit}/${results.length} · streak ${streak}\n${g}`;
}

/** Question sentence from the situation only: "The Giants trail 19–3 with 13:37 left in the 4th. 1 yard to go at midfield." */
export function situationSentence(item: DailyItem, nick: (abbr: string) => string): string {
  const s = item.situation;
  const a = s.posteam_score, b = s.defteam_score;
  const score = a === b ? `are tied ${a}–${b}` : a > b ? `lead ${a}–${b}` : `trail ${b}–${a}`;
  const q = s.qtr >= 5 ? "overtime" : `the ${["1st", "2nd", "3rd", "4th"][s.qtr - 1]}`;
  const togo = isGoalToGo(item) ? `Goal to go from the ${s.yardline_100}` : `${s.distance} yard${s.distance === 1 ? "" : "s"} to go`;
  const at = isGoalToGo(item) ? "" : s.yardline_100 === 50 ? " at midfield" : s.yardline_100 > 50 ? ` at their own ${100 - s.yardline_100}` : ` at the ${s.defteam} ${s.yardline_100}`;
  return `The ${nick(s.posteam)} ${score} with ${clockText(item)} left in ${q}. ${togo}${at}.`;
}
