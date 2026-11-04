import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPacks, loadSchedule } from "./themeData";
import { THEME_HOLDS, calls, situationLine, themeFact, themedSet, hasThemedDay } from "./themeReveal";

const packs = loadPacks();
const days = loadSchedule().days;

test("theme holds for all 5 plays on every scheduled day", () => {
  for (const [d, day] of Object.entries(days)) {
    const set = themedSet(day, packs[day.theme].items);
    assert.ok(set, `${d} ${day.theme}`);
    assert.equal(set!.length, 5);
    for (const i of set!) assert.ok(THEME_HOLDS[day.theme](i), `${d} ${i.id}`);
  }
});

test("off-theme or missing plays give no set (empty state, no wrong reveal)", () => {
  const day = Object.values(days).find((x) => x.theme === "goal-line")!;
  const items = packs["goal-line"].items.map((i) => (i.id === day.ids[0] ? { ...i, situation: { ...i.situation, yardline_100: 40 } } : i));
  assert.equal(themedSet(day, items), null);
  assert.equal(themedSet({ ...day, ids: [...day.ids.slice(1), "nope"] }, packs["goal-line"].items), null);
  assert.equal(themedSet(undefined, []), null);
});

test("fan text: no ids, win chance, or betting words", () => {
  for (const [, day] of Object.entries(days)) for (const i of themedSet(day, packs[day.theme].items)!) {
    const t = `${situationLine(i)} ${themeFact(day.theme, i)}`;
    assert.doesNotMatch(t, /\d{3,}-|%|EPA|WPA|spread|odds|vegas/i, t);
    assert.ok(calls(i).includes("go") && calls(i).includes("punt"));
  }
});

test("end-screen Bonus round button: shown on themed days, hidden otherwise", () => {
  const days = loadSchedule().days as Record<string, { ids: string[] }>;
  const themed = Object.keys(days)[0];
  assert.ok(themed, "schedule has a themed day");
  assert.equal(hasThemedDay(days, themed), true);
  assert.equal(hasThemedDay(days, "1999-01-01"), false);
  assert.equal(hasThemedDay(days, ""), false);
  assert.equal(hasThemedDay({ "2026-01-01": { ids: [] } }, "2026-01-01"), false);
});
