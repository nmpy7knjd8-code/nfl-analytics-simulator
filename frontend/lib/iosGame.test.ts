/**
 * iOS v2 live daily game (/ and /daily). A visual-only change: this test pins the game logic and the
 * GAME_EXACT route list, and checks the color and chrome rules. Frozen daily days and the pack/schedule
 * stay pinned by lib/dailyLock.test.ts.
 * REGENERATE the sha256 pins ONLY in a PR that intentionally changes game logic or scoring.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const sha = (p: string) => createHash("sha256").update(readFileSync(new URL(p, import.meta.url))).digest("hex");

const LOGIC_SHA256: Record<string, string> = {
  "./daily.ts": "5da7b74beff680af1546e3ec1e5f5f726593187260563540b9cdd15e89f8e23e",
  "./simpleGame.ts": "da4bc703861acf8a3dae98aaba8a7186e2738f0b7fcf99ef944707efe8edd1ab",
  "./hardMode.ts": "a1abc2d0680404819fc62495dee8498451e5bc7be5751f2fad61bae9c5e0ff2a",
  "./challenge.ts": "93dfce337cf86c29c2c658777a1807bd01fe6ed118542c1c30318d323a777243",
};
const GAME_EXACT = ["/", "/daily", "/practice", "/endless", "/feed", "/kicks", "/about", "/daily/stats", "/era", "/calibration", "/outcomes", "/heatmap", "/match-chart", "/wheres-the-ball", "/fake-punt", "/two-point", "/games", "/swing", "/fourth-down", "/story", "/comebacks", "/on-this-day", "/first-down", "/more", "/explore"]; // as of PR 342 (base)

const css = read("../app/ios-game.css");
const touched = ["../app/ios-game.css", "../components/SimpleGame.tsx", "../components/TvScoreBug.tsx", "../components/IosField.tsx", "./tvBug.ts"].map(read).join("\n");
const newParts = ["../app/ios-game.css", "../components/TvScoreBug.tsx", "../components/IosField.tsx"].map(read).join("\n");

test("game logic and scoring files are byte-identical to main", () => {
  for (const [f, want] of Object.entries(LOGIC_SHA256)) assert.equal(sha(f), want, `${f} changed`);
});

test("GAME_EXACT is unchanged, so / and /daily keep no tab bar during play", () => {
  const nav = read("../components/AppNav.tsx");
  const list = nav.match(/const GAME_EXACT = new Set\((\[[^\]]*\])\)/)?.[1];
  assert.ok(list, "GAME_EXACT not found");
  assert.deepEqual(JSON.parse(list), GAME_EXACT);
  assert.doesNotMatch(css, /ios-tabbar|tab-bar|bottom-nav/);
});

test("daily game uses the iOS bar with the shared SiteMenu, the iOS bug and the trademark footer", () => {
  const sg = read("../components/SimpleGame.tsx");
  assert.match(sg, /<div className="ios-game"><SimpleGamePlay mode="daily" \/><\/div>/);
  assert.match(sg, /<Header right=\{counter\} onBack=\{onPlayBack\} \/><PlayProgress step=\{idx\} total=\{n\} \/>/);
  assert.match(sg, /ios \? shortQuestion\(it\) : situationSentence\(it, nick\)/);
  assert.match(sg, /ios \? <TvScoreBug item=\{it\} \/> : <ScoreBug item=\{it\} \/>/);
  assert.match(sg, /<Trademark \/>/);
  for (const p of ["../app/page.tsx", "../app/daily/page.tsx"]) assert.match(read(p), /ios-game\.css/);
});

test("colors: token blue is the only accent; dark mode only via tokens; no banned colors or words", () => {
  assert.doesNotMatch(touched, /#1e5bff/i);
  assert.doesNotMatch(touched, /--ios-(success|warning|danger)|--ios-chart-series/);
  assert.doesNotMatch(css, /prefers-color-scheme|data-theme/, "dark comes from tokens.css only (no toggle)");
  // Every hex in the CSS is a neutral (white, black, the bug center or field greens): no second accent.
  const hexes = new Set([...css.matchAll(/#[0-9a-f]{3,6}\b/gi)].map((m) => m[0].toLowerCase()));
  for (const h of hexes) assert.ok(["#fff", "#000", "#1c1c1e", "#1a2a20", "#141f18"].includes(h), `unexpected color ${h}`);
  // The new play screen never draws the old gold first-down line or the .sg-edge team strips.
  assert.doesNotMatch(newParts, /#ffd400|sg-edge/i);
  assert.doesNotMatch(touched, /\bEPA\b|\bWPA\b|betting|moneyline|sportsbook/i);
});

test("white text on the token blue is 19px bold or larger (AA large text in light and dark)", () => {
  for (const sel of [".ios-game .sg-btn,.ios-game .sg-next", ".ios-game .sg-btn small", ".ios-game .tv-flag"]) {
    const body = css.match(new RegExp(`(?:^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{([^}]*)\\}`))?.[1] ?? "";
    assert.ok(Number(body.match(/font-size:(\d+)px/)?.[1]) >= 19, `${sel} font-size`);
    assert.match(body, /font-weight:(7|8)00/, `${sel} weight`);
  }
});

test("choice and action buttons and the disclosure row are at least 48px tall", () => {
  assert.match(css, /\.ios-game \.sg-btn,\.ios-game \.sg-next\{min-height:56px/);
  assert.match(css, /\.ios-game \.ml-sum\{min-height:48px/);
});

test("short question and choice subtitles (display only)", async () => {
  const { shortQuestion, choiceSubtitle } = await import("../components/SimpleGame");
  const { dailySet } = await import("./daily");
  const { tappable } = await import("./simpleGame");
  const items = dailySet("2026-11-04");
  for (const it of items) {
    const q = shortQuestion(it);
    assert.match(q, /^[A-Z][\w ]+ ball\. Go for it or (kick|punt)\?$/);
    assert.doesNotMatch(q, /tied|lead|trail/);
    const ids = tappable(it).map((o) => o.id);
    assert.ok(ids.length >= 2 && ids.length <= 3 && ids[0] === "go");
    if (ids.includes("punt")) assert.equal(choiceSubtitle(it, "punt"), "Kick it away");
    if (ids.includes("fg")) assert.equal(choiceSubtitle(it, "fg"), `${Math.round(it.situation.yardline_100 + 18)} yds`);
    assert.match(choiceSubtitle(it, "go"), /^(\d+ yds? to go|Goal to go)$/);
  }
});
