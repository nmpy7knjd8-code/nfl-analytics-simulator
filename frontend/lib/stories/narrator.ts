/**
 * Game Story narrator: TypeScript port of PR #58 (backend/src/nfl_sim/narrator.py), same templates and
 * selection, so the static site can tell the story from the game file. Every value comes from one play row.
 * House rule: overtime shows no win chance, so OT sentences drop the swing / win-% part.
 */
export type NarrRow = {
  play_id: number; qtr: number; clock: string | null; posteam: string | null; down: number | null;
  ydstogo: number | null; text: string; play_type: string | null; home_wp: number | null;
  home_wp_after: number | null; swing: boolean; home_score: number | null; away_score: number | null;
};

const QTR: Record<number, string> = { 1: "the first quarter", 2: "the second quarter", 3: "the third quarter", 4: "the fourth quarter" };

type Kind = "td" | "interception" | "fumble" | "fg_good" | "fg_miss" | "punt" | "fourth_go" | "play";

export function kind(r: NarrRow): Kind {
  const t = (r.text || "").toUpperCase();
  const pt = r.play_type;
  if (t.includes("INTERCEPTED")) return "interception";
  if (t.includes("FUMBLES") && t.includes("RECOVERED BY") && (pt === "pass" || pt === "run")) return "fumble";
  if (t.includes("TOUCHDOWN") && (pt === "pass" || pt === "run")) return "td";
  if (pt === "field_goal") return t.includes("IS GOOD") ? "fg_good" : "fg_miss";
  if (pt === "punt") return "punt";
  if (r.down === 4 && (pt === "pass" || pt === "run")) return "fourth_go";
  return "play";
}

const T: Record<Kind, string> = {
  td: "{team} scored a touchdown with {clock} left in {period}, a {swing}-point swing toward {gainer}.",
  interception: "{opp} intercepted {team} with {clock} left in {period}, a {swing}-point swing toward {gainer}.",
  fumble: "A {team} fumble with {clock} left in {period} swung win chances {swing} points toward {gainer}.",
  fg_good: "{team}'s field goal with {clock} left in {period} moved {gainer} to {gainer_wp}% to win.",
  fg_miss: "{team} came away empty on a field goal try with {clock} left in {period}; {gainer} rose to {gainer_wp}%.",
  punt: "A {team} punt with {clock} left in {period} swung win chances {swing} points toward {gainer}.",
  fourth_go: "{team} went for it on fourth and {togo} with {clock} left in {period}; {gainer} moved to {gainer_wp}%.",
  play: "With {clock} left in {period}, one {team} play swung win chances {swing} points toward {gainer}.",
};

/** Overtime: same events, no win chance or swing size. */
const OT: Record<Kind, string> = {
  td: "{team} scored a touchdown with {clock} left in overtime.",
  interception: "{opp} intercepted {team} with {clock} left in overtime.",
  fumble: "{team} fumbled with {clock} left in overtime.",
  fg_good: "{team} made a field goal with {clock} left in overtime.",
  fg_miss: "{team} came away empty on a field goal try with {clock} left in overtime.",
  punt: "{team} punted with {clock} left in overtime.",
  fourth_go: "{team} went for it on fourth and {togo} with {clock} left in overtime.",
  play: "{team} ran a key play with {clock} left in overtime.",
};

export function facts(r: NarrRow, home: string, away: string): Record<string, string> {
  const team = r.posteam || "";
  const before = r.home_wp ?? 0.5, after = r.home_wp_after ?? before;
  const gainer = after >= before ? home : away;
  return {
    team, opp: team ? (team === home ? away : home) : "", gainer, clock: r.clock || "",
    period: QTR[r.qtr] ?? "overtime", swing: String(Math.round(Math.abs(after - before) * 100)),
    gainer_wp: String(Math.round((gainer === home ? after : 1 - after) * 100)), togo: String(r.ydstogo ?? ""),
  };
}

export function sentence(r: NarrRow, home: string, away: string): string {
  const f = facts(r, home, away);
  return (r.qtr > 4 ? OT : T)[kind(r)].replace(/\{(\w+)\}/g, (_, k) => f[k] ?? "");
}

const delta = (r: NarrRow) => Math.abs((r.home_wp_after ?? 0) - (r.home_wp ?? 0));
const usable = (r: NarrRow) => r.home_wp != null && r.home_wp_after != null;

/** 3–5 rows: the biggest swings, in game order (same rule as #58's story()). */
export function storyRows<R extends NarrRow>(rows: R[], min = 3, max = 5): R[] {
  let picks = rows.filter((r) => r.swing && usable(r));
  if (picks.length < min) {
    const extra = rows.filter((r) => !picks.includes(r) && usable(r) && r.posteam).sort((a, b) => delta(b) - delta(a));
    picks = picks.concat(extra.slice(0, min - picks.length));
  }
  const top = picks.slice().sort((a, b) => delta(b) - delta(a) || a.play_id - b.play_id).slice(0, max);
  const order = new Map(rows.map((r, i) => [r, i]));
  return top.sort((a, b) => order.get(a)! - order.get(b)!);
}
