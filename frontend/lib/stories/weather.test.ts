import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gameWeather, isWeatherDoc } from "./weather";

const raw = readFileSync(new URL("../../public/data/stories/weather.json", import.meta.url), "utf8");
const doc = JSON.parse(raw);

test("public copy is identical to data/site/weather.json", () => {
  assert.equal(raw, readFileSync(new URL("../../../data/site/weather.json", import.meta.url), "utf8"));
  assert.ok(isWeatherDoc(doc));
});

test("open-air game reads wind and temperature with its wind band", () => {
  assert.deepEqual(gameWeather(doc, "2024_08_CHI_WAS"), { kind: "outdoors", text: "2 mph wind · 58°F", note: "Games with 0–9 mph wind averaged 45.9 total points." });
});

test("roofed games get an Indoors badge; unknown games get nothing", () => {
  assert.equal(gameWeather(doc, doc.indoors[0])?.text, "Indoors");
  assert.equal(gameWeather(doc, "1999_01_XXX_YYY"), null);
});

test("every badge is plain words: no ids, no stat names, no betting words", () => {
  for (const id of [...Object.keys(doc.games), ...doc.indoors]) {
    const w = gameWeather(doc, id)!;
    assert.doesNotMatch(`${w.text} ${w.note}`, /_|EPA|WPA|odds|bet|over\/under/i);
  }
});

test("the feed header mounts the badge", () => {
  assert.match(readFileSync(new URL("../../components/PlayFeedC6.tsx", import.meta.url), "utf8"), /gameWeather\(/);
});
