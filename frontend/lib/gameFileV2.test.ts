import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { expandGameV2, feedRowsFromGameV2, gameFileUrl, isGameFileV2, type GameFileV2 } from "./gameFileV2";
import { GAME_PLAY_LISTS } from "./gamePlays";

test("game.v2 DET@KC expands to the real nflverse play list with all swing plays", () => {
  const raw = JSON.parse(readFileSync(new URL("./__fixtures__/2023_01_DET_KC.json", import.meta.url), "utf8")) as GameFileV2;
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

test("game.v2 → feed rows: real plays only, fan text by play_id, raw text otherwise", () => {
  const raw = JSON.parse(readFileSync(new URL("./__fixtures__/2023_01_DET_KC.json", import.meta.url), "utf8")) as GameFileV2;
  assert.ok(isGameFileV2(raw));
  assert.equal(isGameFileV2({ schema_version: "game.v1" }), false);
  assert.equal(gameFileUrl("2023_01_DET_KC", "/nfl-analytics-simulator"), "/nfl-analytics-simulator/data/games/2023_01_DET_KC.json");
  const fan = new Map(GAME_PLAY_LISTS["2023_01_DET_KC"].plays.map((p) => [p.play_id, p.display_text]));
  const rows = feedRowsFromGameV2(raw, fan);
  assert.ok(rows.every((r) => r.text !== "GAME" && !/^END QUARTER|^Timeout/.test(r.text)));
  const ids = rows.map((r) => r.play_id);
  for (const p of GAME_PLAY_LISTS["2023_01_DET_KC"].plays) assert.ok(ids.includes(p.play_id), `plays-file row ${p.play_id} in the live file`);
  const branch = rows.find((r) => /Brian Branch intercepts/.test(r.text));
  assert.ok(branch, "export display_text wins over raw desc");
  const bare = feedRowsFromGameV2(raw);
  assert.ok(bare.some((r) => /^\(\d+:\d\d\)/.test(r.text)), "without fan text the raw nflverse desc shows (never invented)");
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].quarter >= rows[i - 1].quarter);
});
