import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expandGameV2, type GameFileV2 } from "./gameFileV2";

test("game.v2 DET@KC expands to the real nflverse play list with all swing plays", () => {
  const raw = JSON.parse(readFileSync(new URL("../public/data/games/2023_01_DET_KC.json", import.meta.url), "utf8")) as GameFileV2;
  const g = expandGameV2(raw);
  assert.equal(g.schema_version, "game.v1");
  assert.equal(g.plays.length, 179);
  const ids = new Set(g.plays.map((p) => p.play_id));
  assert.ok(raw.swing_play_ids.length >= 10 && raw.swing_play_ids.every((id) => ids.has(id)));
  const last = g.plays.at(-1)!;
  assert.equal(last.home_wp_after, 0); // KC (home) lost 21–20
  const p4204 = g.plays.find((p) => p.play_id === 4204)!;
  assert.equal(p4204.down, 3); // QA2 M5: KC's last snap was 3rd down, not 4th
  for (const p of g.plays) if (p.fourth_down && "fg" in p.fourth_down.wp) assert.ok(p.fourth_down.kick_distance! <= 64);
});
