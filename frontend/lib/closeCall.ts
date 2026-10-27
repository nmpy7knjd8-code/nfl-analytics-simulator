import { availableChoices, MAX_FG_YARDS, type QuizChoice, type QuizReveal, type QuizSituation } from "./quiz";

/** Recheck P1-D: the label for a field goal that's out of range (a disabled row, never credited). */
export const FG_OUT_OF_RANGE = `Too far to kick (${MAX_FG_YARDS + 1}+ yards)`;
export const ALL_CHOICES: QuizChoice[] = ["go", "fg", "punt"];

const DOING: Record<QuizChoice, string> = { go: "going for it", fg: "kicking a field goal", punt: "punting" };
const whole = (v: number) => `${Math.round(v * 100)}%`;

function list(parts: string[]): string {
  return parts.length <= 2 ? parts.join(" and ") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/**
 * Recheck P2-E: one plain sentence for a close call, built from the reveal values, e.g.
 * "Punting and going for it give about the same win chance (24% vs 23%)."
 * Only offered options count; a third joins when it's as close to the top as the second is.
 */
export function closeCallWhy(item: { reveal: QuizReveal; situation: Pick<QuizSituation, "yardline_100"> }): string {
  const ranked = availableChoices(item)
    .map((c) => ({ c, v: item.reveal.values[c] as number }))
    .sort((a, b) => b.v - a.v);
  if (ranked.length < 2) return item.reveal.layman_why;
  const gap = ranked[0].v - ranked[1].v;
  const close = ranked.filter((r, i) => i < 2 || ranked[0].v - r.v <= Math.max(gap, 0.01));
  const names = list(close.map((r) => DOING[r.c]));
  const nums = close.length === 2 ? `${whole(close[0].v)} vs ${whole(close[1].v)}` : list(close.map((r) => whole(r.v)));
  return `${names[0].toUpperCase()}${names.slice(1)} give about the same win chance (${nums}).`;
}
