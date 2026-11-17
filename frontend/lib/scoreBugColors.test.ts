import { test } from "node:test";
import assert from "node:assert/strict";
import teamColors from "./teamColors.json";
import { contrastRatio, ensureAA, inkOn, scoreBugPanels, teamSwatch } from "./scoreBugColors";

const TEAMS = Object.keys((teamColors as { teams: Record<string, unknown> }).teams);

test("every team primary can be made AA with black or white ink", () => {
  for (const t of TEAMS) {
    const p = ensureAA(teamSwatch(t).primary);
    assert.ok(contrastRatio(p.bg, p.ink) >= 4.5, `${t} ${p.bg} on ${p.ink}`);
    assert.ok(p.ink === "#FFFFFF" || p.ink === "#000000", t);
  }
});

test("DET @ KC panels keep team hues and meet AA, and do not clash", () => {
  const { away, home } = scoreBugPanels("DET", "KC");
  assert.ok(contrastRatio(away.bg, away.ink) >= 4.5);
  assert.ok(contrastRatio(home.bg, home.ink) >= 4.5);
  assert.ok(contrastRatio(away.bg, home.bg) >= 2, "sides must stay distinct");
  assert.notEqual(away.bg, home.bg);
});

test("clashing same-family colors still produce distinct AA panels", () => {
  // NYJ and PHI are both green; CIN and TB are both orange-red.
  for (const [a, h] of [["NYJ", "PHI"], ["CIN", "TB"], ["BAL", "MIN"], ["SEA", "LAC"]] as const) {
    const { away, home } = scoreBugPanels(a, h);
    assert.ok(contrastRatio(away.bg, away.ink) >= 4.5, `${a}`);
    assert.ok(contrastRatio(home.bg, home.ink) >= 4.5, `${h}`);
    assert.ok(contrastRatio(away.bg, home.bg) >= 2, `${a} vs ${h}`);
    assert.notEqual(away.bg, home.bg, `${a} vs ${h}`);
  }
});

test("inkOn picks the higher-contrast ink", () => {
  assert.equal(inkOn("#000000"), "#FFFFFF");
  assert.equal(inkOn("#FFFFFF"), "#000000");
});
