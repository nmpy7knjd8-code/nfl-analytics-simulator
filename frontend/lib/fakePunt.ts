// B2 "Real punt or fake?": a 4th-down punt situation from nflverse; the fan guesses real or fake.
// Data: lib/site/fakes.json (copy of data/site/fakes.json, built by mining/build_fakes.py).
export type PuntPlay = {
  season: number; week: number; season_type: "REG" | "POST"; game_id: string;
  team: string; opp: string; qtr: number; clock: string; down: number; togo: number; yardline_100: number;
  score: number; opp_score: number; kind: "run" | "pass" | "punt"; first_down: 0 | 1 | null; wp: number | null; desc: string;
};
export type FakesFile = {
  schema_version: number; season_list: number[]; count: number; first_downs: number; first_down_rate: number;
  punt_count: number; plays: PuntPlay[]; real_punts: PuntPlay[];
};
export type Guess = "real" | "fake";
export type Card = { play: PuntPlay; answer: Guess };

export const ROUND_SIZE = 5;
/** Share of fakes in a round (plan B2: "1-in-3 fakes"). */
export const FAKE_SHARE = 1 / 3;

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
const playKey = (p: PuntPlay) => `${p.game_id}|${p.qtr}|${p.clock}|${p.kind}`;

/** Only regulation situations (no overtime) with a real situation to show. */
const usable = (p: PuntPlay) => p.qtr >= 1 && p.qtr <= 4 && p.down === 4;

/** Deterministic round for a seed: each card is a fake with chance FAKE_SHARE, drawn without repeats. */
export function buildRound(file: FakesFile, seed: string, size = ROUND_SIZE): Card[] {
  const rand = rng(hash(`fake-punt:${seed}`));
  const pools = {
    fake: file.plays.filter(usable).sort((a, b) => playKey(a).localeCompare(playKey(b))),
    real: file.real_punts.filter(usable).sort((a, b) => playKey(a).localeCompare(playKey(b))),
  };
  const out: Card[] = [];
  for (let i = 0; i < size; i++) {
    let answer: Guess = rand() < FAKE_SHARE ? "fake" : "real";
    if (pools[answer].length === 0) answer = answer === "fake" ? "real" : "fake";
    const pool = pools[answer];
    if (pool.length === 0) break;
    const [play] = pool.splice(Math.floor(rand() * pool.length), 1);
    out.push({ play, answer });
  }
  return out;
}

export const isCorrect = (card: Card, guess: Guess) => card.answer === guess;

/** "own 30", "midfield", "BUF 10" (opponent's side), from the offense's view. */
export function spotText(p: PuntPlay): string {
  const y = p.yardline_100;
  if (y === 50) return "midfield";
  return y > 50 ? `their own ${100 - y}` : `the ${p.opp} ${y}`;
}

export function scoreText(p: PuntPlay): string {
  const d = p.score - p.opp_score;
  if (d === 0) return `tied ${p.score}–${p.opp_score}`;
  return d > 0 ? `up ${p.score}–${p.opp_score}` : `down ${p.score}–${p.opp_score}`;
}

const QTR = ["", "1st", "2nd", "3rd", "4th"];
/** Plain situation line. Clock is game clock left in the quarter. */
export function situationText(p: PuntPlay): string {
  return `${p.team} is ${scoreText(p)}, 4th & ${p.togo} at ${spotText(p)}, ${p.clock.replace(/^0/, "")} left in the ${QTR[p.qtr]}. The punter is back.`;
}

/** nflverse play text made plain: no clock prefix, formation tag, or jersey numbers; trimmed to fit. */
export function plainDesc(desc: string, max = 150): string {
  let s = desc
    .replace(/^\(\d{1,2}:\d{2}\)\s*/, "")
    .replace(/\((Punt formation|Shotgun|No Huddle)\)\s*/gi, "")
    .replace(/\b\d{1,2}-(?=[A-Z])/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) s = s.slice(0, s.lastIndexOf(" ", max - 1)).replace(/[,;.]$/, "") + "…";
  return s;
}

/** Short "Why" line for the reveal. Uses only counts in the file. */
export function whyText(card: Card): string {
  const p = card.play;
  if (card.answer === "fake") {
    const how = p.kind === "run" ? "a run" : "a pass";
    const res = p.first_down ? "and got the first down" : "and came up short";
    return `It was ${how} out of punt formation, ${res}.`;
  }
  return `A real punt: ${plainDesc(p.desc, 90)}`;
}

export const pct = (n: number, d: number) => (d ? Math.round((100 * n) / d) : 0);

/** The real rates shown on every reveal. */
export function ratesText(file: FakesFile): string {
  return `Since ${file.season_list[0]}: ${file.count} fakes vs ${file.punt_count.toLocaleString("en-US")} punts. Fakes got a first down ${file.first_downs} of ${file.count} times (${pct(file.first_downs, file.count)}%).`;
}

export function shareText(results: boolean[], right: number): string {
  return `Real punt or fake? ${right}/${results.length}\n${results.map((r) => (r ? "✅" : "⬜")).join("")}`;
}
