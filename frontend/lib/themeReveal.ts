/** B3 theme reveal: play today's themed bonus 5 without being told the theme, then reveal it after play 5. */
import type { MarathonPackItem, PackChoice, ThemeDay, ThemeId, ThemePackItem } from "../contracts/themePacks";
import { teamNickname } from "./teams";

export type Call = PackChoice;
export const CALL_LABEL: Record<Call, string> = { go: "Go for it", punt: "Punt", fg: "Field goal" };

/** What every play in a theme has in common. The reveal only shows a theme when all 5 plays pass it. */
export const THEME_HOLDS: Record<ThemeId, (i: ThemePackItem) => boolean> = {
  "goal-line": (i) => i.situation.down === 4 && i.situation.yardline_100 <= 5,
  playoffs: (i) => i.situation.down === 4 && i.source.week >= 19,
  marathon: (i) => i.situation.down === 4 && ((i as MarathonPackItem).drivePlays ?? 0) >= 12,
};

export const THEME_NAME: Record<ThemeId, string> = { "goal-line": "Goal line", playoffs: "Playoffs", marathon: "Long drives" };
export const THEME_LINE: Record<ThemeId, string> = {
  "goal-line": "Every play was a 4th down at the other team's 5 or closer.",
  playoffs: "Every play came from a playoff game.",
  marathon: "Every play came on a drive of 12 or more plays.",
};

/** The fact on one play that shows it fits the theme. */
export function themeFact(t: ThemeId, i: ThemePackItem): string {
  if (t === "goal-line") return `At the ${i.situation.yardline_100}`;
  if (t === "playoffs") return { 19: "Wild Card", 20: "Divisional round", 21: "Conference title game", 22: "Super Bowl" }[i.source.week] ?? "Playoffs";
  const m = i as MarathonPackItem;
  return `Play ${m.playOrder} of ${m.drivePlays} on the drive`;
}

/** Today's set in schedule order, or null when there's no themed day or a play is missing or off-theme. */
export function themedSet(day: ThemeDay | undefined, items: ThemePackItem[]): ThemePackItem[] | null {
  if (!day) return null;
  const byId = new Map(items.map((i) => [i.id, i]));
  const set = day.ids.map((id) => byId.get(id));
  if (set.some((i) => !i) || !(set as ThemePackItem[]).every(THEME_HOLDS[day.theme])) return null;
  return set as ThemePackItem[];
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
/** "4th & 2 at the Jets 4 · 1st quarter, 6:37 · Dolphins 0, Jets 0" */
export function situationLine(i: ThemePackItem): string {
  const s = i.situation;
  const yl = s.yardline_100 === 50 ? "midfield" : s.yardline_100 < 50 ? `the ${teamNickname(s.defteam)} ${s.yardline_100}` : `their own ${100 - s.yardline_100}`;
  const dist = s.yardline_100 <= s.distance ? "goal" : String(s.distance);
  const q = ["1st", "2nd", "3rd", "4th"][s.qtr - 1] ?? `Q${s.qtr}`;
  return `4th & ${dist} at ${yl} · ${q} quarter, ${clock(s.quarter_seconds_remaining)} · ${teamNickname(s.posteam)} ${s.posteam_score}, ${teamNickname(s.defteam)} ${s.defteam_score}`;
}

export function coachLine(i: ThemePackItem): string {
  const a = i.historical_action;
  return a === "go" ? "The coach went for it." : a === "punt" ? "The coach punted." : a === "fg" ? "The coach kicked a field goal." : "No call on record.";
}

export const matchedCoach = (i: ThemePackItem, c: Call) => i.historical_action === c;

/** FG only within 64-yard tries (line of scrimmage + 17). */
export const calls = (i: ThemePackItem): Call[] => (i.situation.yardline_100 + 17 <= 64 ? ["go", "punt", "fg"] : ["go", "punt"]);
