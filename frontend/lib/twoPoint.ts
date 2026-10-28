// B1 concept 1, "Kick or go for two?": a real two-point try from nflverse; the fan makes the call,
// then sees what the coach did, how it went, and the real league rates. No per-choice win chance
// exists (per_choice_win_chance is null), so none is shown or invented.
export type Rate = { tries: number; made: number; rate: number };
export type TwoPointFile = {
  schema_version: number; season_list: number[];
  two_point: Rate & { run: Rate; pass: Rate };
  extra_point: Rate;
  per_choice_win_chance: null;
  cols: string[];
  tries: (string | number)[][];
};
export type Try = {
  season: number; week: number; season_type: "REG" | "POST"; game_id: string; team: string; opp: string;
  qtr: number; clock: string; diff: number; kind: "run" | "pass"; made: boolean;
};
export type Call = "kick" | "run" | "pass";

export const ROUND_SIZE = 5;

/** Rows → objects by the cols header. Drops overtime and no_play rows (no play type to guess). */
export function readTries(file: TwoPointFile): Try[] {
  const at = (n: string) => file.cols.indexOf(n);
  const ix = Object.fromEntries(["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made"].map((n) => [n, at(n)]));
  if (Object.values(ix).some((i) => i < 0)) return [];
  return file.tries
    .map((r) => ({
      season: Number(r[ix.season]), week: Number(r[ix.week]), season_type: r[ix.season_type] as Try["season_type"],
      game_id: String(r[ix.game_id]), team: String(r[ix.team]), opp: String(r[ix.opp]), qtr: Number(r[ix.qtr]),
      clock: String(r[ix.clock]), diff: Number(r[ix.diff]), kind: r[ix.kind] as Try["kind"], made: Number(r[ix.made]) === 1,
    }))
    .filter((t) => t.qtr >= 1 && t.qtr <= 4 && (t.kind === "run" || t.kind === "pass"));
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic round for a seed, no repeats. */
export function buildRound(tries: Try[], seed: string, size = ROUND_SIZE): Try[] {
  const rand = rng(hash(`two-point:${seed}`));
  const pool = [...tries].sort((a, b) => `${a.game_id}|${a.qtr}|${a.clock}`.localeCompare(`${b.game_id}|${b.qtr}|${b.clock}`));
  const out: Try[] = [];
  while (out.length < size && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

/** Every try in the file is a real two-point try, so the coach's call is go for two with that play type.
 * Scored as "same call as the coach": no model says which choice was right in that spot. */
export const sameAsCoach = (t: Try, call: Call) => call === t.kind;

/** Shown rates, one decimal, from the file's counts. */
export const pct1 = (r: { tries: number; made: number }) => (r.tries ? `${((1000 * r.made) / r.tries / 10).toFixed(1)}%` : "—");

export function marginText(diff: number): string {
  if (diff === 0) return "tied";
  return diff > 0 ? `up ${diff}` : `down ${-diff}`;
}
const QTR = ["", "1st", "2nd", "3rd", "4th"];
export function situationText(t: Try): string {
  return `${t.team} just scored a touchdown. They're ${marginText(t.diff)} with ${t.clock.replace(/^0/, "")} left in the ${QTR[t.qtr]}.`;
}

export const CALL_LABEL: Record<Call, string> = { kick: "Kick the extra point", run: "Go for two: run", pass: "Go for two: pass" };

export function coachText(t: Try): string {
  return `Went for two with a ${t.kind}. ${t.made ? "Good, 2 points." : "No good."}`;
}

export function ratesLines(file: TwoPointFile): string[] {
  const tp = file.two_point, xp = file.extra_point;
  return [
    `Extra points: good ${pct1(xp)} (${xp.made.toLocaleString("en-US")} of ${xp.tries.toLocaleString("en-US")})`,
    `Two-point tries: good ${pct1(tp)} (${tp.made} of ${tp.tries})`,
    `Runs ${pct1(tp.run)} (${tp.run.made} of ${tp.run.tries}) · passes ${pct1(tp.pass)} (${tp.pass.made} of ${tp.pass.tries})`,
  ];
}

export function shareText(results: boolean[]): string {
  const n = results.filter(Boolean).length;
  return `Kick or go for two? Same call as the coach ${n}/${results.length}\n${results.map((r) => (r ? "✅" : "⬜")).join("")}`;
}
