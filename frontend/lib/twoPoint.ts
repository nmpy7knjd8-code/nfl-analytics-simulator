// B1 concept 1, "Kick or go for two?": a real two-point try from nflverse; the fan makes the call,
// then sees what the coach did, how it went, and the real league rates. This game shows no win
// chance: the data file's per-choice section is for a later chart behind the checker flag, and the UI never reads it.
export type Rate = { tries: number; made: number; rate: number };
export type TwoPointFile = {
  schema_version: number; season_list: number[];
  two_point: Rate & { run: Rate; pass: Rate };
  extra_point: Rate;
  cols: string[];
  tries: (string | number | null)[][];
  kicks?: (string | number | null)[][];
  kick_rule?: string;
};
export type Try = {
  season: number; week: number; season_type: "REG" | "POST"; game_id: string; team: string; opp: string;
  qtr: number; clock: string; diff: number; kind: "run" | "pass" | "extra_point"; made: boolean;
  /** nflverse vegas_wp for the trying team before/after the try (#282); null when missing or OT. */
  wp_before?: number | null; wp_after?: number | null;
};
export type Call = "kick" | "run" | "pass";

export const ROUND_SIZE = 5;

function readRows(file: TwoPointFile, rows: (string | number | null)[][]): Try[] {
  const at = (n: string) => file.cols.indexOf(n);
  const ix = Object.fromEntries(["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made"].map((n) => [n, at(n)]));
  if (Object.values(ix).some((i) => i < 0)) return [];
  const wb = at("wp_before"), wa = at("wp_after");
  const num = (r: (string | number | null)[], i: number) => (i < 0 || r[i] == null || !Number.isFinite(Number(r[i])) ? null : Number(r[i]));
  return rows
    .map((r) => ({
      season: Number(r[ix.season]), week: Number(r[ix.week]), season_type: r[ix.season_type] as Try["season_type"],
      game_id: String(r[ix.game_id]), team: String(r[ix.team]), opp: String(r[ix.opp]), qtr: Number(r[ix.qtr]),
      clock: String(r[ix.clock]), diff: Number(r[ix.diff]), kind: r[ix.kind] as Try["kind"], made: Number(r[ix.made]) === 1,
      wp_before: num(r, wb), wp_after: num(r, wa),
    }))
    .filter((t) => t.qtr >= 1 && t.qtr <= 4);
}

/** Two-point tries by the cols header. Drops overtime and no_play rows (no play type to guess). */
export function readTries(file: TwoPointFile): Try[] {
  return readRows(file, file.tries).filter((t) => t.kind === "run" || t.kind === "pass");
}

/** Real extra points from file.kicks (late, close spots; see kick_rule). Own path: kind is "extra_point". */
export function readKicks(file: TwoPointFile): Try[] {
  return readRows(file, file.kicks ?? []).filter((t) => t.kind === "extra_point");
}

/** Kicks per round of ROUND_SIZE; the rest are two-point tries. */
export const KICKS_PER_ROUND = 2;

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

const key = (t: Try) => `${t.game_id}|${t.qtr}|${t.clock}|${t.kind}`;
function draw(pool0: Try[], k: number, rand: () => number): Try[] {
  const pool = [...pool0].sort((a, b) => key(a).localeCompare(key(b)));
  const out: Try[] = [];
  while (out.length < k && pool.length) out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return out;
}

/** Deterministic round for a seed, no repeats: KICKS_PER_ROUND real kicks + two-point tries, shuffled. */
export function buildRound(tries: Try[], seed: string, size = ROUND_SIZE, kicks: Try[] = []): Try[] {
  const rand = rng(hash(`two-point:${seed}`));
  const nk = Math.min(kicks.length, size >= ROUND_SIZE ? KICKS_PER_ROUND : Math.floor((size * KICKS_PER_ROUND) / ROUND_SIZE));
  const picked = [...draw(kicks, nk, rand), ...draw(tries, size - nk, rand)];
  return draw(picked, picked.length, rand);
}

/** The coach's call: kick on an extra point, else go for two with that play type.
 * Scored as "same call as the coach": no model says which choice was right in that spot. */
export const coachCall = (t: Try): Call => (t.kind === "extra_point" ? "kick" : t.kind);
export const sameAsCoach = (t: Try, call: Call) => call === coachCall(t);

/** Shown rates, one decimal, from the file's counts. */
export const pct1 = (r: { tries: number; made: number }) => (r.tries ? `${((1000 * r.made) / r.tries / 10).toFixed(1)}%` : "—");

export function marginText(diff: number): string {
  if (diff === 0) return "tied";
  return diff > 0 ? `up ${diff}` : `down ${-diff}`;
}
const QTR = ["", "1st", "2nd", "3rd", "4th"];
export function situationText(t: Try): string {
  return `${t.team} just scored a touchdown. They're ${marginText(t.diff)} before the try with ${t.clock.replace(/^0/, "")} left in the ${QTR[t.qtr]}.`;
}

export const CALL_LABEL: Record<Call, string> = { kick: "Kick the extra point", run: "Go for two: run", pass: "Go for two: pass" };

export function coachText(t: Try): string {
  if (t.kind === "extra_point") return `Kicked the extra point. ${t.made ? "Good, 1 point." : "No good."}`;
  return `Went for two with a ${t.kind}. ${t.made ? "Good, 2 points." : "No good."}`;
}

/** Reveal header: did the player pick what the coach picked. */
export const matchHeader = (same: boolean) => (same ? "You matched the coach" : "You didn't match the coach");

/** The coach's call alone, without the result (the result gets its own line). */
export function coachCallText(t: Try): string {
  return t.kind === "extra_point" ? "Kicked the extra point" : `Went for two with a ${t.kind}`;
}

/** League rate for the kind of try the coach called. */
export function leagueRateFor(file: TwoPointFile, t: Try): Rate {
  return t.kind === "extra_point" ? file.extra_point : file.two_point[t.kind];
}

const KIND_PLURAL: Record<Try["kind"], string> = { extra_point: "extra points", run: "two-point runs", pass: "two-point passes" };

/** Result on its own line: good or no good, then plainly whether that matched the league rate. */
export function resultText(t: Try): string {
  return t.made ? (t.kind === "extra_point" ? "Good, 1 point" : "Good, 2 points") : "No good";
}
export function leagueMatchText(file: TwoPointFile, t: Try): string {
  const r = leagueRateFor(file, t);
  const kind = KIND_PLURAL[t.kind];
  const most = r.made * 2 >= r.tries ? `Most ${kind} are good.` : `Most ${kind} fail.`;
  return `${most} The league converts ${pct1(r)}.`;
}

/** Button rate label: the league-wide rate, not this team's chance. */
export const leagueLabel = (r: { tries: number; made: number }) => `League: ${pct1(r)}`;

export function ratesLines(file: TwoPointFile): string[] {
  const tp = file.two_point, xp = file.extra_point;
  return [
    `Extra points: good ${pct1(xp)} (${xp.made.toLocaleString("en-US")} of ${xp.tries.toLocaleString("en-US")})`,
    `Two-point tries: good ${pct1(tp)} (${tp.made} of ${tp.tries})`,
    `Runs ${pct1(tp.run)} (${tp.run.made} of ${tp.run.tries}) · passes ${pct1(tp.pass)} (${tp.pass.made} of ${tp.pass.tries})`,
  ];
}

/** Tries in the two-point total that are neither a run nor a pass (penalties or kneels), or null if none. */
export function otherTriesNote(file: TwoPointFile): string | null {
  const tp = file.two_point;
  const n = tp.tries - tp.run.tries - tp.pass.tries, good = tp.made - tp.run.made - tp.pass.made;
  if (n <= 0) return null;
  return `Includes ${n} ${n === 1 ? "try" : "tries"} (${good} good) wiped out by penalties or kneels.`;
}

export function shareText(results: boolean[]): string {
  const n = results.filter(Boolean).length;
  return `Kick or go for two? Same call as the coach ${n}/${results.length}\n${results.map((r) => (r ? "✅" : "⬜")).join("")}`;
}

/** Q4 lines by the margin after the touchdown, before the try (trying team's side), -16 to 16.
 * Each compares the score after two (+2) with after a kick (+1) and what the next score does. */
export const MARGIN_LINES: Record<number, string> = {
  [-16]: "Down 16: two leaves them down 14, so two touchdowns and kicks tie. A kick leaves them down 15.",
  [-15]: "Down 15: two leaves them down 13, so two touchdowns and kicks win. A kick leaves them down 14, and those only tie.",
  [-14]: "Down 14: two leaves them down 12, a kick down 13. Either way two touchdowns and kicks win.",
  [-13]: "Down 13: two leaves them down 11, so two touchdowns win. A kick leaves them down 12, where two touchdowns need a kick to win.",
  [-12]: "Down 12: two leaves them down 10, so a touchdown, kick and field goal tie. A kick leaves them down 11.",
  [-11]: "Down 11: two leaves them down 9, so a touchdown and field goal tie. A kick leaves them down 10, so they'd need the extra point too.",
  [-10]: "Down 10: two leaves them down 8, so a touchdown and two ties. A kick leaves them down 9, still two scores.",
  [-9]: "Down 9: two leaves them down 7, so a touchdown and kick ties. A kick leaves them down 8.",
  [-8]: "Down 8: two leaves them down 6, so a touchdown ties. A kick leaves them down 7, so they'd need the extra point too.",
  [-7]: "Down 7: two leaves them down 5, so a touchdown wins. A kick leaves them down 6, so a touchdown only ties.",
  [-6]: "Down 6: two leaves them down 4, a kick down 5. Either way a touchdown wins and a field goal doesn't.",
  [-5]: "Down 5: two makes it a field-goal game, a kick leaves them down 4.",
  [-4]: "Down 4: two leaves them down 2, so a field goal wins. A kick leaves them down 3, so a field goal only ties.",
  [-3]: "Down 3: two leaves them down 1, a kick down 2. A field goal wins either way.",
  [-2]: "Down 2: going for two ties it, a kick doesn't.",
  [-1]: "Down 1: two takes the lead, a kick ties.",
  [0]: "Tied: two puts them up 2, a kick up 1. A field goal beats either.",
  [1]: "Up 1: two puts them up 3, so a field goal only ties. A kick leaves them up 2.",
  [2]: "Up 2: two puts them up 4, so a field goal can't tie. A kick leaves them up 3.",
  [3]: "Up 3: two makes it 5, a kick 4. Either way a field goal can't tie and a touchdown wins.",
  [4]: "Up 4: two puts them up 6, so the other team needs a touchdown and the extra point to win. A kick leaves them up 5.",
  [5]: "Up 5: two puts them up 7, so a touchdown and kick only ties. A kick leaves them up 6, where that wins.",
  [6]: "Up 6: two puts them up 8, so the other team needs a touchdown and two to tie. A kick leaves them up 7.",
  [7]: "Up 7: two puts them up 9, a two-score game. A kick leaves them up 8, so a touchdown and two ties.",
  [8]: "Up 8: two puts them up 10, a kick up 9. Either way it's a two-score game.",
  [9]: "Up 9: two puts them up 11, a kick up 10. Either way it's a two-score game.",
  [10]: "Up 10: two puts them up 12, so two touchdowns only tie. A kick leaves them up 11, where two touchdowns win.",
  [11]: "Up 11: two puts them up 13, so two touchdowns need a kick to tie. A kick leaves them up 12, where two touchdowns tie.",
  [12]: "Up 12: two puts them up 14, so two touchdowns and kicks only tie. A kick leaves them up 13, where those win.",
  [13]: "Up 13: two puts them up 15, so two touchdowns and kicks fall short. A kick leaves them up 14, where those tie.",
  [14]: "Up 14: two puts them up 16, a kick up 15. Either way two touchdowns and kicks fall short.",
  [15]: "Up 15: two puts them up 17, a three-score game. A kick leaves them up 16, where two touchdowns with two-point tries tie.",
  [16]: "Up 16: two puts them up 18, a kick up 17. Either way it's a three-score game.",
};
export const EARLY_LINE = "Early on, both choices average about one point.";
export const NEUTRAL_LINE = "Both choices average about one point.";

/** Seconds left in the quarter from the data's quarter clock ("MM:SS"), or NaN. */
export function clockSeconds(clock: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(clock ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** One plain line on the try from the score alone (no rates, no model numbers).
 * Q1, Q2, or Q3 with more than 5:00 left: EARLY_LINE. Q4 regulation, |diff| <= 16: MARGIN_LINES.
 * Otherwise (Q3 under 5:00, bigger margins, OT, missing data): NEUTRAL_LINE. */
export function verdictText(_file: TwoPointFile, t: Try): string {
  const q = Number(t.qtr);
  if (q === 1 || q === 2) return EARLY_LINE;
  if (q === 3) return clockSeconds(t.clock) > 300 ? EARLY_LINE : NEUTRAL_LINE;
  if (q === 4 && Number.isInteger(t.diff) && t.diff in MARGIN_LINES) return MARGIN_LINES[t.diff];
  return NEUTRAL_LINE;
}
