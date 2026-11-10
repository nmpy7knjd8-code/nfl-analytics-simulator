import { CLOSE_MARGIN, availableChoices, fieldGoalYards, type QuizChoice, type QuizReveal, type QuizSituation } from "./quiz";

/** Recheck 2054 P3-B: an out-of-range field goal names this kick's real distance (yardline + 18), not the cutoff. */
export function fgTooFarButton(s: Pick<QuizSituation, "yardline_100">): string {
  return `Field goal · ${fieldGoalYards(s)}-yd kick, too far`;
}
/** QA 2220 L9: in-range field goal names its distance too. */
export function fgButton(s: Pick<QuizSituation, "yardline_100">): string {
  return `Field goal · ${fieldGoalYards(s)}-yd kick`;
}
export function fgTooFarReveal(s: Pick<QuizSituation, "yardline_100">): string {
  return `Too far (${fieldGoalYards(s)} yd)`;
}

export const ALL_CHOICES: QuizChoice[] = ["go", "fg", "punt"];

const DOING: Record<QuizChoice, string> = { go: "going for it", fg: "kicking a field goal", punt: "punting" };
/**
 * QA 2220 L8: shared percent formatter. Whole percents, unless two of the values being compared round to
 * the same whole number; then every value gets one decimal ("62.1% vs 61.7%").
 */
export function formatPercents(values: number[]): string[] {
  const r = values.map((v) => Math.round(v * 100));
  const clash = r.some((x, i) => r.indexOf(x) !== i);
  return values.map((v) => (clash ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`));
}
const pair = (vs: number[]) => formatPercents(vs);

function list(parts: string[]): string {
  return parts.length <= 2 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Recheck P2-E: one plain sentence for a close call, built from the reveal values, e.g.
 * "Punting and going for it give about the same win chance (24% vs 23%)."
 * Only offered options count; a third joins when it's as close to the top as the second is.
 */
type CloseItem = { reveal: QuizReveal; situation: Pick<QuizSituation, "yardline_100"> };

/** Shared numbers for a close call: "24% vs 23%" (or a list for three). */
function closeNumbers(item: CloseItem): string | null {
  const ranked = availableChoices(item)
    .map((c) => ({ c, v: item.reveal.values[c] as number }))
    .sort((a, b) => b.v - a.v);
  if (ranked.length < 2) return null;
  const gap = ranked[0].v - ranked[1].v;
  const close = ranked.filter((r, i) => i < 2 || ranked[0].v - r.v <= Math.max(gap, 0.01));
  const f = pair(close.map((r) => r.v));
  return close.length === 2 ? `${f[0]} vs ${f[1]}` : list(f);
}

const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** Offered options within CLOSE_MARGIN of the best, best first. */
export function nearTieOptions(item: CloseItem): { c: QuizChoice; v: number }[] {
  const ranked = availableChoices(item)
    .map((c) => ({ c, v: item.reveal.values[c] as number }))
    .sort((a, b) => b.v - a.v);
  return ranked.filter((r) => ranked.length && ranked[0].v - r.v <= CLOSE_MARGIN + 1e-9);
}

/**
 * Recheck 2146 P2-G reveal note, real numbers from the reveal values.
 * Correct top pick: "Going for it was about as good (23%)." Close-call pick: "Punting was a little better (24% vs 23%), so this pick gets ½."
 */
export function closeCallNote(item: CloseItem, picked: QuizChoice, result: "correct" | "near_tie"): string | null {
  const near = nearTieOptions(item);
  if (near.length < 2) return null;
  if (result === "correct") {
    const others = near.filter((r) => r.c !== picked);
    const f = pair(near.map((r) => r.v));
    const fo = others.map((r) => f[near.indexOf(r)]);
    return `${cap(list(others.map((r) => DOING[r.c])))} ${others.length > 1 ? "were" : "was"} about as good (${list(fo)}).`;
  }
  const mine = item.reveal.values[picked] as number;
  const [a, b] = pair([near[0].v, mine]);
  // QA M13: never "0.1% vs 0.1%".
  if (a === b) return `${cap(DOING[near[0].c])} was about as good (both ${a}), so this pick gets ½.`;
  return `${cap(DOING[near[0].c])} was a little better (${a} vs ${b}), so this pick gets ½.`;
}

export function closeCallWhy(item: CloseItem): string {
  const ranked = availableChoices(item)
    .map((c) => ({ c, v: item.reveal.values[c] as number }))
    .sort((a, b) => b.v - a.v);
  if (ranked.length < 2) return item.reveal.layman_why;
  const gap = ranked[0].v - ranked[1].v;
  const close = ranked.filter((r, i) => i < 2 || ranked[0].v - r.v <= Math.max(gap, 0.01));
  const names = list(close.map((r) => DOING[r.c]));
  const f = pair(close.map((r) => r.v));
  const same = f.every((x) => x === f[0]);
  const nums = same ? `${close.length === 2 ? "both" : "all"} ${f[0]}` : close.length === 2 ? `${f[0]} vs ${f[1]}` : list(f);
  return `${names[0].toUpperCase()}${names.slice(1)} give about the same win chance (${nums}).`;
}
