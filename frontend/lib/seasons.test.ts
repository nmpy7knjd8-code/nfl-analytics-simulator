import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import {
  COACHES_DIR, GAMES_DIR, coachSeasons, gameSeasons, seasonRangeText, seasonsFromDir, seasonsFromNames,
} from "./seasons";

const CURRENT = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

test("current committed game and coach files are 2019–2025, and the range text matches", () => {
  assert.deepEqual(gameSeasons(), CURRENT);
  assert.deepEqual(gameSeasons("desc"), [...CURRENT].reverse());
  assert.deepEqual(coachSeasons(), CURRENT);
  assert.equal(seasonRangeText(gameSeasons()), "2019–2025");
  assert.equal(seasonRangeText(coachSeasons()), "2019–2025");
});

test("a new season file (2026) is picked up automatically", () => {
  const with2026 = [...CURRENT.map((s) => `${s}.json`), "2026.json", "calls", "readme.txt", "index.json"];
  assert.deepEqual(seasonsFromNames(with2026), [...CURRENT, 2026]);
  assert.deepEqual(seasonsFromNames(with2026, "desc"), [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
  assert.equal(seasonRangeText(seasonsFromNames(with2026)), "2019–2026");
  assert.equal(seasonRangeText([2026]), "2026");
  assert.equal(seasonRangeText([]), "");
});

test("non-year files in the data dirs are ignored (e.g. coaches/calls)", () => {
  const names = readdirSync(COACHES_DIR);
  assert.ok(names.includes("calls") || names.includes("2025.json"));
  assert.ok(!seasonsFromDir(COACHES_DIR).some((s) => Number.isNaN(s)));
  assert.ok(readdirSync(GAMES_DIR).every((n) => n.endsWith(".json")));
  assert.deepEqual(seasonsFromNames(["calls", "notes.md", "20xx.json", "2019.json.bak"]), []);
});
