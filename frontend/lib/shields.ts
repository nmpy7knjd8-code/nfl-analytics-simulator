/**
 * B5 streak shields. Each Monday–Sunday week has one shield. The first missed day
 * in a week is covered by that week's shield, so the streak survives. A second miss
 * in the same week ends it. Covered days don't add to the streak.
 * Dates are "YYYY-MM-DD" keys and the math is in UTC, so DST changes can't shift a day.
 */
export type DayMark = "played" | "shield" | "missed" | "future" | "before";

const MS_DAY = 86_400_000;
const toMs = (k: string) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const toKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (k: string, n: number) => toKey(toMs(k) + n * MS_DAY);
/** Monday of the week the key falls in. */
export const weekStart = (k: string) => addDays(k, -((new Date(toMs(k)).getUTCDay() + 6) % 7));

export type ShieldState = { streak: number; marks: Map<string, DayMark>; shieldUsedThisWeek: boolean };

/** Walk from the first played day to today. Today unplayed is still open, not a miss. */
export function shieldStreak(played: Iterable<string>, today: string): ShieldState {
  const set = new Set(played);
  const marks = new Map<string, DayMark>();
  const first = [...set].filter((d) => d <= today).sort()[0];
  if (!first) return { streak: 0, marks, shieldUsedThisWeek: false };
  const used = new Set<string>();
  let streak = 0;
  for (let d = first; d <= today; d = addDays(d, 1)) {
    if (set.has(d)) { marks.set(d, "played"); streak++; continue; }
    if (d === today) break;
    const w = weekStart(d);
    if (streak > 0 && !used.has(w)) { used.add(w); marks.set(d, "shield"); }
    else { marks.set(d, "missed"); streak = 0; }
  }
  return { streak, marks, shieldUsedThisWeek: used.has(weekStart(today)) };
}

/** Calendar cells for the last `weeks` Monday-first weeks ending this week. */
export function calendarCells(st: ShieldState, today: string, weeks = 5): { date: string; mark: DayMark }[] {
  const start = addDays(weekStart(today), -7 * (weeks - 1));
  const first = [...st.marks.keys()].sort()[0];
  return Array.from({ length: weeks * 7 }, (_, i) => {
    const date = addDays(start, i);
    const mark: DayMark = st.marks.get(date) ?? (date > today || date === today ? "future" : first && date > first ? "missed" : "before");
    return { date, mark };
  });
}
