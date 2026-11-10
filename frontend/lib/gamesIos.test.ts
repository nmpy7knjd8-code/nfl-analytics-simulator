import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = dirname(fileURLToPath(import.meta.url)) + "/..";
const FILES = [
  "app/games/page.tsx",
  "app/games/GamesIndex.tsx",
  "app/games/games-ios.css",
  "app/games/[gameId]/page.tsx",
  "app/games/[gameId]/GameDetail.tsx",
  "components/GameScoreBug.tsx",
  "lib/scoreBugColors.ts",
];

const read = (rel: string) => readFileSync(join(FRONTEND, rel), "utf8");
const blob = FILES.map((f) => `/* ${f} */\n` + read(f)).join("\n");

test("/games and /games/[gameId] render the trademark footer and are off the legacy allowlist", () => {
  assert.match(read("app/games/page.tsx"), /<Trademark\s*\/>/);
  assert.match(read("app/games/[gameId]/page.tsx"), /<Trademark\s*\/>/);
  assert.match(read("app/games/[gameId]/page.tsx"), /className="sg-app ios-games"/);
  const chrome = read("lib/routeChrome.test.ts");
  assert.match(chrome, /LEGACY_ROUTES = new Set<string>\(\[\]\)/);
  assert.doesNotMatch(chrome, /"\/games\/\[gameId\]"/);
});

test("changed games files contain none of the banned colors", () => {
  const banned = [
    /#1[Ee]5[Bb][Ff]{2}/,
    /#34c759/i,
    /#30d158/i,
    /#ff9f0a/i,
    /#ffd60a/i,
    /#af52de/i,
    /#bf5af2/i,
    /--ios-success/,
    /--ios-warning/,
    /--ios-chart-series-[2-4]/,
  ];
  for (const re of banned) {
    assert.doesNotMatch(blob, re, String(re));
  }
});

test("house-rule words stay off the games restyle fan screens", () => {
  assert.doesNotMatch(blob, /\bEPA\b/);
  assert.doesNotMatch(blob, /\bWPA\b/);
  assert.doesNotMatch(blob, /\bxpass\b/i);
  assert.doesNotMatch(blob, /\bbetting\b/i);
  assert.doesNotMatch(blob, /\bodds\b/i);
  assert.doesNotMatch(blob, /\bmoneyline\b/i);
  assert.doesNotMatch(blob, /["'`][^"'`]{0,80}\b(pts|points)\b[^"'`]{0,80}["'`]/i);
  // play_id may appear as a data key; it must not be shown as fan text.
  assert.doesNotMatch(blob, /["'`][^"'`]{0,40}play[_ -]?id[^"'`]{0,40}["'`]/i);
  // Overtime win chance must not be plotted; the existing chart already stops at regulation.
  assert.match(read("components/WinProbabilityChart.tsx"), /Regulation only/);
  assert.match(read("app/games/[gameId]/page.tsx"), /Win chance/);
});

test("games restyle uses the system font and iOS tokens, not Inter", () => {
  const css = read("app/games/games-ios.css");
  assert.match(css, /font-family:\s*var\(--ios-font-text\)/);
  assert.doesNotMatch(css, /Inter|Roboto/);
  assert.match(css, /prefers-color-scheme:\s*dark|var\(--ios-background-grouped\)/);
  assert.match(css, /--ios-accent/);
  assert.match(read("app/games/page.tsx"), /ios-large-title/);
  assert.match(read("app/games/[gameId]/page.tsx"), /GameScoreBug/);
});

test("rows, back link, picker, segmented control and Show all are at least 44px", () => {
  const css = read("app/games/games-ios.css");
  for (const sel of [".ios-picker-btn", ".ios-show-all", ".ios-back", ".ios-seg-btn", ".ios-play-row", ".ios-game-row", ".swing-link"]) {
    assert.ok(css.includes(sel), sel);
  }
  assert.match(css, /min-height:\s*var\(--ios-touch\)/);
  assert.match(css, /\.ios-game-row[^}]*min-height:\s*56px/);
  assert.match(read("app/games/[gameId]/GameDetail.tsx"), /Show all \{rows\.length\} plays/);
  assert.match(read("app/games/[gameId]/GameDetail.tsx"), /Show all \{state\.drives\.length\} drives/);
});

test("winner emphasis is semibold weight, not a color, and team colors stay on the score bug", () => {
  const css = read("app/games/games-ios.css");
  assert.match(css, /\.ios-game-sc\.is-winner,\s*\.gsb-sc\.is-winner\s*\{[^}]*font-weight:\s*600;[^}]*color:\s*inherit/);
  const scoreBug = read("components/GameScoreBug.tsx");
  assert.match(scoreBug, /scoreBugPanels/);
  assert.match(scoreBug, /style=\{\{ background: panels\.away\.bg, color: panels\.away\.ink \}\}/);
  assert.doesNotMatch(read("app/games/GamesIndex.tsx"), /scoreBugPanels|teamColor\(/);
  assert.match(read("app/games/GamesIndex.tsx"), /gameCardHref/);
});

test("season and week pickers are sheet lists, not clipped chips", () => {
  const src = read("app/games/GamesIndex.tsx");
  assert.match(src, /role="dialog"/);
  assert.doesNotMatch(src, /pf-chip|ch-chips/);
  assert.match(src, /SEASONS/);
  assert.match(src, /weeksOf/);
});

test("unbuilt game cards still link through gameCardHref", async () => {
  assert.match(read("app/games/GamesIndex.tsx"), /gameCardHref\(g\.id, builtSet\)/);
  const { gameCardHref } = await import("./gamePicker");
  const { FIXTURE_GAMES } = await import("./fixtures");
  const built = new Set(FIXTURE_GAMES.items.map((g) => g.game_id));
  assert.equal(gameCardHref("2023_01_DET_KC", built), "/games/2023_01_DET_KC");
  assert.equal(gameCardHref("2024_08_CHI_WAS", built), "/feed/?game=2024_08_CHI_WAS");
});
