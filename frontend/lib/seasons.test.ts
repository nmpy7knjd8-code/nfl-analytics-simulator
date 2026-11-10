import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  COACHES_DIR, GAMES_DIR, coachSeasons, gameSeasons, seasonCoverageText, seasonRangeText, seasonsFromDir, seasonsFromNames,
} from "./seasons";

const CURRENT = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

test("current committed game and coach files are 2019–2025, and the range text matches", () => {
  assert.deepEqual(gameSeasons(), CURRENT);
  assert.deepEqual(gameSeasons("desc"), [...CURRENT].reverse());
  assert.deepEqual(coachSeasons(), CURRENT);
  assert.equal(seasonRangeText(gameSeasons()), "2019–2025");
  assert.equal(seasonCoverageText(gameSeasons()), "2019–2025");
  assert.equal(seasonRangeText(coachSeasons()), "2019–2025");
  assert.equal(seasonCoverageText(coachSeasons()), "2019–2025");
});

test("a new season (2026) is picked up from an unsorted list of file names", () => {
  const names = ["calls", "2024.json", "2026.json", "2019.json", "readme.txt", "2022.json", "2025.json", "2020.json", "index.json", "2023.json", "2021.json", "2026.json"];
  assert.deepEqual(seasonsFromNames(names), [...CURRENT, 2026]);
  assert.deepEqual(seasonsFromNames(names, "desc"), [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019]);
  assert.equal(seasonRangeText(seasonsFromNames(names)), "2019–2026");
  assert.equal(seasonCoverageText(seasonsFromNames(names)), "2019–2026");
  assert.equal(seasonRangeText([2026]), "2026");
  assert.equal(seasonCoverageText([2026]), "2026");
});

test("empty input yields no seasons and no range text", () => {
  assert.deepEqual(seasonsFromNames([]), []);
  assert.deepEqual(seasonsFromNames(["calls", "notes.md", "20xx.json", "2019.json.bak"]), []);
  assert.equal(seasonRangeText([]), "");
  assert.equal(seasonCoverageText([]), "");
});

test("a gap makes a closed range read as if missing seasons were included, so copy says since the first year", () => {
  assert.equal(seasonRangeText([2025, 2019, 2021]), "2019–2025");
  assert.equal(seasonCoverageText([2025, 2019, 2021]), "since 2019");
  assert.equal(seasonCoverageText([2024, 2026]), "since 2024");
});

test("non-year files in the data dirs are ignored (e.g. coaches/calls)", () => {
  const names = readdirSync(COACHES_DIR);
  assert.ok(names.includes("calls") || names.includes("2025.json"));
  assert.ok(!seasonsFromDir(COACHES_DIR).some((s) => Number.isNaN(s)));
  assert.ok(readdirSync(GAMES_DIR).every((n) => n.endsWith(".json")));
});

test("game picker, playoffs, rivalries, coaches, and team/rivalry copy do not hard-code a 2019-2025 range", () => {
  const files = [
    "gamePicker.ts",
    "playoffs.ts",
    "rivalries.ts",
    "coaches.ts",
    "../components/GamePicker.tsx",
    "../components/PlayFeedC6.tsx",
    "../components/TeamRedzone.tsx",
    "../components/CoachesView.tsx",
    "../app/team/page.tsx",
    "../app/team/[abbr]/page.tsx",
    "../app/rivalry/page.tsx",
    "../app/rivalry/[pair]/page.tsx",
    "../app/playoffs/page.tsx",
    "../app/feed/page.tsx",
    "../app/coaches/page.tsx",
  ];
  for (const f of files) {
    const src = readFileSync(new URL(f, import.meta.url), "utf8");
    assert.equal(src.includes("2019–2025"), false, f);
    assert.equal(src.includes("2019-2025"), false, f);
    assert.equal(/\[2019,\s*2020/.test(src), false, f);
    assert.equal(/\[2025,\s*2024/.test(src), false, f);
  }
});
