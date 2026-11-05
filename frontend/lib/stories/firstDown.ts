/** G1 First down: guess the 1st & 10 call (pass or run), then see if it worked (firstdown/v1, real nflverse plays). */
export type Rate = { plays: number; avg_yards: number; good: number };
export type FirstDownDoc = { schema: "firstdown/v1"; per_week: number; cols: string[]; plays: unknown[][]; league: { pass: Rate; run: Rate } };
export type Call = "pass" | "run";
export type FdPlay = {
  season: number; week: number; gameId: string; offense: string; defense: string; qtr: number; clock: string;
  yardline: number; offScore: number; defScore: number; call: Call; yards: number; result: "TD" | "1D" | "GAIN" | "INC" | "INT" | "FUM";
};

export function isFirstDownDoc(x: unknown): x is FirstDownDoc {
  const d = x as FirstDownDoc;
  return !!d && d.schema === "firstdown/v1" && Array.isArray(d.plays) && Array.isArray(d.cols) && !!d.league?.pass && !!d.league?.run && d.per_week > 0;
}

export function plays(d: FirstDownDoc): FdPlay[] {
  const i = (c: string) => d.cols.indexOf(c);
  return d.plays.map((r) => ({
    season: r[i("season")] as number, week: r[i("week")] as number, gameId: r[i("game_id")] as string,
    offense: r[i("offense")] as string, defense: r[i("defense")] as string, qtr: Number(r[i("qtr")]), clock: r[i("clock")] as string,
    yardline: Number(r[i("yardline_100")]), offScore: r[i("off_score")] as number, defScore: r[i("def_score")] as number,
    call: r[i("call")] as Call, yards: r[i("yards")] as number, result: r[i("result")] as FdPlay["result"],
  }));
}

/** "Good" = 4+ yards, a first down or a touchdown, with no turnover. */
export const isGood = (p: FdPlay): boolean => p.result !== "INT" && p.result !== "FUM" && (p.result === "TD" || p.result === "1D" || p.yards >= 4);

/** This week's set: weeks since 2026-01-05 (a Monday) pick a slice of `per_week` plays, wrapping. */
export function weekSet(d: FirstDownDoc, now: Date): FdPlay[] {
  const all = plays(d);
  if (!all.length) return [];
  const wk = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(2026, 0, 5)) / (7 * 864e5));
  const n = d.per_week, slots = Math.max(1, Math.floor(all.length / n));
  const start = (((wk % slots) + slots) % slots) * n;
  return all.slice(start, start + n);
}

export function spotText(p: FdPlay): string {
  return p.yardline === 50 ? "at midfield" : p.yardline > 50 ? `at own ${100 - p.yardline}` : `at ${p.defense} ${p.yardline}`;
}
export function scoreText(p: FdPlay): string {
  if (p.offScore === p.defScore) return `tied ${p.offScore}–${p.defScore}`;
  return `${p.offense} ${p.offScore > p.defScore ? "leads" : "trails"} ${p.offScore}–${p.defScore}`;
}
export const situation = (p: FdPlay): string =>
  `Q${p.qtr} · ${p.clock.replace(/^0(\d)/, "$1")} · 1st & 10 ${spotText(p)} · ${scoreText(p)}`;

export function outcomeText(p: FdPlay): string {
  const what = p.call === "pass" ? "Pass" : "Run";
  const y = (n: number) => `${Math.abs(n)} ${Math.abs(n) === 1 ? "yard" : "yards"}`;
  switch (p.result) {
    case "TD": return `${what} for a touchdown.`;
    case "1D": return `${what} for ${y(p.yards)} and a first down.`;
    case "INC": return "Pass incomplete.";
    case "INT": return "Pass intercepted.";
    case "FUM": return `${what}, fumble lost.`;
    default: return p.yards < 0 ? `${what} for a loss of ${y(p.yards)}.` : p.yards === 0 ? `${what} for no gain.` : `${what} for ${y(p.yards)}.`;
  }
}

/** League rate as a fan reads it, never "0%". */
export const pct = (x: number): string => { const n = Math.round(x * 100); return n < 1 ? "<1%" : `${n}%`; };
