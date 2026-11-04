import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dayLabel, games, isOnThisDayDoc, mmdd, pickDay, scoreLine } from "./onThisDay";

const raw = readFileSync(new URL("../../public/data/stories/onthisday.json", import.meta.url), "utf8");
const doc = JSON.parse(raw);

test("public copy is identical to data/site/onthisday.json", () => {
  assert.equal(raw, readFileSync(new URL("../../../data/site/onthisday.json", import.meta.url), "utf8"));
  assert.ok(isOnThisDayDoc(doc));
});

test("Jan 1 has real games, newest first, read with team abbreviations and no ids", () => {
  assert.deepEqual(pickDay(doc, "01-01"), { key: "01-01", exact: true });
  const g = games(doc, "01-01");
  assert.ok(g.length > 0);
  assert.ok(g.every((x, k) => k === 0 || g[k - 1].year >= x.year));
  assert.ok(g.some((x) => scoreLine(x) === "ARI 19, ATL 20"));
  for (const x of g) assert.doesNotMatch(scoreLine(x), /_|\d{4}/);
  assert.equal(dayLabel("01-01"), "January 1");
});

test("fallback moves to the nearest day with games; summer jumps to September", () => {
  const p = pickDay(doc, "01-27");
  assert.ok(p && !p.exact && doc.days[p.key].length > 0);
  assert.deepEqual(pickDay(doc, "07-04"), { key: "09-04", exact: false });
  assert.equal(pickDay({ ...doc, fallback: {} }, "07-04"), null);
  assert.equal(mmdd(new Date(2026, 10, 4)), "11-04");
});

test("old team codes read as today's names", () => {
  const all = Object.keys(doc.days).flatMap((k) => games(doc, k));
  assert.ok(all.every((g) => !["OAK", "SD", "STL"].includes(g.away) && !["OAK", "SD", "STL"].includes(g.home)));
});

test("QA C4: '(OT)' after the score when the row's ot flag is set; works with or without the column", () => {
  const base = { schema: "onthisday/v1" as const, days: {}, fallback: {} };
  const withOt = { ...base, cols: ["game_id", "year", "away_score", "home_score", "ot"],
    days: { "11-04": [["2024_09_TB_KC", 2024, 24, 30, 1], ["2021_09_NYJ_IND", 2021, 30, 45, 0]] } };
  const g = games(withOt, "11-04");
  assert.equal(scoreLine(g.find((x) => x.year === 2024)!), "TB 24, KC 30 (OT)");
  assert.equal(scoreLine(g.find((x) => x.year === 2021)!), "NYJ 30, IND 45");
  const noOt = { ...base, cols: ["game_id", "year", "away_score", "home_score"], days: { "11-04": [["2024_09_TB_KC", 2024, 24, 30]] } };
  assert.equal(scoreLine(games(noOt, "11-04")[0]), "TB 24, KC 30");
});
