import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_FEED_GAME, SEASONS, feedHref, feedUrlToWrite, finalScore, gameFromQuery, gamesInWeek, isSeasonIndex, matchup, searchGames, seasonOf, weeksOf,
  type SeasonIndex,
} from "./gamePicker";

const idx = (s: number) => JSON.parse(readFileSync(new URL(`../public/data/games/${s}.json`, import.meta.url), "utf8")) as SeasonIndex;

test("every picker season has a committed games index", () => {
  for (const s of SEASONS) {
    const d = idx(s);
    assert.ok(isSeasonIndex(d), String(s));
    assert.ok(d.games.length > 250 && d.games.every((g) => g.season === s));
  }
  assert.ok(idx(seasonOf(DEFAULT_FEED_GAME)).games.some((g) => g.id === DEFAULT_FEED_GAME));
});

test("weeks: regular season then playoff rounds, in order", () => {
  const w = weeksOf(idx(2023).games);
  assert.deepEqual(w.slice(0, 3).map((x) => x.week), [1, 2, 3]);
  assert.deepEqual(w.slice(-5).map((x) => x.label), ["Week 18", "Wild Card", "Divisional", "Conference", "Super Bowl"]);
  const w20 = weeksOf(idx(2020).games);
  assert.equal(w20.filter((x) => x.label.startsWith("Week")).length, 17);
  assert.deepEqual(w20.at(-1), { week: 21, label: "Super Bowl", short: "Super Bowl" });
  for (const s of SEASONS) for (const x of weeksOf(idx(s).games)) if (!x.label.startsWith("Week")) assert.ok(gamesInWeek(idx(s).games, x.week).every((g) => g.season_type === "POST"));
  // a gap in the index shows as an empty week, not a missing button
  const g = idx(2023).games.filter((x) => x.week !== 5);
  assert.ok(weeksOf(g).some((x) => x.week === 5));
  assert.deepEqual(gamesInWeek(g, 5), []);
});

test("week 1 2023 lists DET @ KC with its final score", () => {
  const wk = gamesInWeek(idx(2023).games, 1);
  assert.equal(wk[0].id, "2023_01_DET_KC"); // Thursday opener first
  assert.equal(matchup(wk[0]), "DET @ KC");
  assert.equal(finalScore(wk[0]), "21–20 Final");
  assert.equal(finalScore({ ...wk[0], home_score: null }), "Not played yet");
});

test("team search by abbreviation or nickname", () => {
  const g = idx(2023).games;
  const kc = searchGames(g, "kc");
  assert.ok(kc.length >= 17 && kc.every((x) => x.home === "KC" || x.away === "KC"));
  assert.deepEqual(searchGames(g, "Chiefs").map((x) => x.id), kc.map((x) => x.id));
  assert.deepEqual(searchGames(g, "  "), []);
  assert.deepEqual(searchGames(g, "zzz"), []);
});

test("?game= round-trips and bad ids fall back to the default", () => {
  assert.equal(gameFromQuery("?game=2024_10_KC_DEN"), "2024_10_KC_DEN");
  assert.equal(gameFromQuery(new URL(feedHref("2025_01_DAL_PHI"), "http://x").search), "2025_01_DAL_PHI");
  for (const bad of ["", "?game=", "?game=../etc", "?game=2024_10_kc_den", "?x=1"]) assert.equal(gameFromQuery(bad), DEFAULT_FEED_GAME);
});

test("the URL always names the game, including the default and the game already shown", () => {
  const B = "/nfl-analytics-simulator";
  assert.equal(feedUrlToWrite(`${B}/feed/`, DEFAULT_FEED_GAME, B), `${B}/feed/?game=${DEFAULT_FEED_GAME}`);
  assert.equal(feedUrlToWrite(`${B}/feed/?x=1`, "2024_10_KC_DEN", B), `${B}/feed/?game=2024_10_KC_DEN`);
  assert.equal(feedUrlToWrite(`${B}/feed/?game=2024_10_KC_DEN`, "2024_10_KC_DEN", B), null);
  assert.equal(feedUrlToWrite(`${B}/feed/?game=2024_10_KC_DEN`, "2023_01_DET_KC", B), `${B}/feed/?game=2023_01_DET_KC`);
});
