/** Short display helpers for quiz scoreboard (abbr → nickname). */

const NICKNAMES: Record<string, string> = {
  ARI: "Cardinals",
  ATL: "Falcons",
  BAL: "Ravens",
  BUF: "Bills",
  CAR: "Panthers",
  CHI: "Bears",
  CIN: "Bengals",
  CLE: "Browns",
  DAL: "Cowboys",
  DEN: "Broncos",
  DET: "Lions",
  GB: "Packers",
  HOU: "Texans",
  IND: "Colts",
  JAX: "Jaguars",
  JC: "Jaguars",
  KC: "Chiefs",
  LA: "Rams",
  LAC: "Chargers",
  LAR: "Rams",
  LV: "Raiders",
  MIA: "Dolphins",
  MIN: "Vikings",
  NE: "Patriots",
  NO: "Saints",
  NYG: "Giants",
  NYJ: "Jets",
  PHI: "Eagles",
  PIT: "Steelers",
  SEA: "Seahawks",
  SF: "49ers",
  TB: "Buccaneers",
  TEN: "Titans",
  WAS: "Commanders",
  OFF: "Offense",
  DEF: "Defense",
};

export function teamNickname(abbr: string): string {
  return NICKNAMES[abbr] ?? abbr;
}

export function ordinalDown(down: number): string {
  if (down === 1) return "1ST";
  if (down === 2) return "2ND";
  if (down === 3) return "3RD";
  return "4TH";
}

export function periodLabel(qtr: number): string {
  if (qtr === 1) return "1st Qtr";
  if (qtr === 2) return "2nd Qtr";
  if (qtr === 3) return "3rd Qtr";
  if (qtr === 4) return "4th Qtr";
  if (qtr === 5) return "OT";
  return `Q${qtr}`;
}
