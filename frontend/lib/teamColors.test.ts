import { test } from "node:test";
import assert from "node:assert/strict";
import teamColors from "./teamColors.json";
import gameFacts from "./gameFacts.json";
import swingPlays from "./swingPlays.json";
import { teamNickname } from "./teams";

// The 32 current nflverse team_abbr values used across the repo (Rams = LA, not LAR).
const TEAMS = [
  "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE", "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
  "LA", "LAC", "LV", "MIA", "MIN", "NE", "NO", "NYG", "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS",
];

const colors = (teamColors as { teams: Record<string, { primary: string; secondary: string; tertiary: string }> }).teams;

test("teamColors has exactly the 32 repo team abbreviations", () => {
  assert.deepEqual(Object.keys(colors).sort(), [...TEAMS].sort());
  for (const t of TEAMS) assert.notEqual(teamNickname(t), t, `${t} unknown to teams.ts`);
});

test("every team id in gameFacts/swingPlays has colors", () => {
  const ids = new Set<string>();
  JSON.stringify([gameFacts, swingPlays]).replace(/"(?:home|away|possession)_team_id":"([A-Z]+)"/g, (_, t) => (ids.add(t), ""));
  assert.ok(ids.size > 0);
  for (const t of ids) assert.ok(colors[t], `${t} missing`);
});

test("each value is { primary, secondary, tertiary } as #RRGGBB, colors only", () => {
  for (const [t, v] of Object.entries(colors)) {
    assert.deepEqual(Object.keys(v).sort(), ["primary", "secondary", "tertiary"], t);
    assert.match(v.primary, /^#[0-9A-F]{6}$/, t);
    assert.match(v.secondary, /^#[0-9A-F]{6}$/, t);
    assert.match(v.tertiary, /^#[0-9A-F]{6}$/, t);
  }
  assert.ok(!/https?:|logo/i.test(JSON.stringify(colors)));
});
