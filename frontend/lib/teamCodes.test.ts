import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { currentTeam, OLD_TEAM_CODES } from "./teamCodes";
import { teamLogo, teamColor } from "../components/ScoreBug";
import { teamNickname } from "./teams";

test("old codes map to the current team; current codes pass through", () => {
  assert.equal(currentTeam("OAK"), "LV");
  assert.equal(currentTeam("SD"), "LAC");
  assert.equal(currentTeam("STL"), "LA");
  assert.equal(currentTeam("KC"), "KC");
});

test("every old code gets a real logo file, color and name (2019_05_CHI_OAK logo 404)", () => {
  for (const [old, cur] of Object.entries(OLD_TEAM_CODES)) {
    assert.ok(teamLogo(old).endsWith(`/teams/${cur}/logo.png`), old);
    assert.ok(existsSync(new URL(`../public/teams/${cur}/logo.png`, import.meta.url)), cur);
    assert.equal(teamColor(old), teamColor(cur));
    assert.equal(teamNickname(old), teamNickname(cur));
  }
  assert.equal(teamNickname("OAK"), "Raiders");
});
