/** Old nflverse team codes -> the team's current code, for logos, colors and names (G4's on-this-day mapping, shared). */
export const OLD_TEAM_CODES: Readonly<Record<string, string>> = { OAK: "LV", SD: "LAC", STL: "LA" };
export const currentTeam = (abbr: string): string => OLD_TEAM_CODES[abbr] ?? abbr;
