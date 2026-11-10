import { test } from "node:test";
import assert from "node:assert/strict";
import colors from "./teamColors.json";
import { clashes, contrast, teamPanel, teamPanels } from "./tvBug";

const TEAMS = Object.keys((colors as { teams: Record<string, unknown> }).teams);

test("every team-color score bug panel passes AA (4.5:1) for its ink", () => {
  assert.equal(TEAMS.length, 32);
  for (const t of TEAMS) {
    const { bg, ink } = teamPanel(t);
    assert.ok(contrast(bg, ink) >= 4.5, `${t} ${bg} on ${ink}: ${contrast(bg, ink).toFixed(2)}`);
  }
});

test("every pairing: both halves pass AA and never clash", () => {
  for (const a of TEAMS) for (const h of TEAMS) {
    if (a === h) continue;
    const p = teamPanels(a, h);
    for (const x of [p.away, p.home]) assert.ok(contrast(x.bg, x.ink) >= 4.5, `${a}@${h} ${x.bg}/${x.ink}`);
    assert.ok(!clashes(p.away.bg, p.home.bg), `${a}@${h} ${p.away.bg} vs ${p.home.bg}`);
  }
});

test("clash examples: SEA at NE uses NE's red; old codes map to the current team", () => {
  assert.equal(teamPanels("SEA", "NE").home.bg, "#C60C30");
  assert.equal(teamPanels("BAL", "CLE").home.bg, teamPanel("CLE").bg);
  assert.equal(teamPanel("CIN").ink, "#000000");
  assert.deepEqual(teamPanel("OAK"), teamPanel("LV"));
});
