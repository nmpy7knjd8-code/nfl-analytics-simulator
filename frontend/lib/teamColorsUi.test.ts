import { test } from "node:test";
import assert from "node:assert/strict";
import teamColors from "./teamColors.json";
import swingPlays from "./swingPlays.json";
import { CLASH, STATE_COLORS, colorDistance, contrast, matchupColors, teamColorSet, textOn } from "./teamColors";

const ALL = Object.keys((teamColors as { teams: Record<string, unknown> }).teams);

test("chip text passes WCAG AA on every team's primary, secondary and tertiary", () => {
  for (const t of ALL) {
    const s = teamColorSet(t)!;
    for (const c of [s.primary, s.secondary, s.tertiary].filter(Boolean) as string[])
      assert.ok(contrast(c, textOn(c)) >= 4.5, `${t} ${c}: ${contrast(c, textOn(c)).toFixed(2)}`);
  }
});

test("matchup colors are each team's own and stay distinct when possible, for all 992 pairings", () => {
  for (const h of ALL)
    for (const a of ALL) {
      if (h === a) continue;
      const m = matchupColors(h, a);
      const own = teamColorSet(a)!;
      assert.equal(m.home, teamColorSet(h)!.primary);
      assert.ok([own.primary, own.secondary, own.tertiary].includes(m.away!), `${a} away uses its own color`);
      if (colorDistance(own.primary, m.home!) >= CLASH) assert.equal(m.away, own.primary, `${h}-${a} keeps primary`);
    }
});

test("clash: when primaries clash the away team switches to its secondary", () => {
  let n = 0;
  for (const h of ALL) for (const a of ALL) {
    if (h === a) continue;
    const hp = teamColorSet(h)!.primary, as = teamColorSet(a)!;
    if (colorDistance(as.primary, hp) < CLASH && colorDistance(as.secondary, hp) >= CLASH) {
      n++;
      assert.equal(matchupColors(h, a).away, as.secondary, `${a}@${h}`);
    }
  }
  assert.ok(n > 0);
});

test("every game-story matchup draws two distinct lines", () => {
  const games = Object.values((swingPlays as unknown as { games: Record<string, { home_team_id: string; away_team_id: string }> }).games);
  assert.ok(games.length >= 3);
  for (const g of games) {
    const m = matchupColors(g.home_team_id, g.away_team_id);
    assert.ok(colorDistance(m.home!, m.away!) >= CLASH, `${g.away_team_id}@${g.home_team_id}`);
  }
});

test("team lines never reuse the swing-dot accent", () => {
  for (const h of ALL) for (const a of ALL) {
    if (h === a) continue;
    const m = matchupColors(h, a);
    for (const c of [m.home!, m.away!]) assert.notEqual(c.toUpperCase(), STATE_COLORS[0]);
  }
});
