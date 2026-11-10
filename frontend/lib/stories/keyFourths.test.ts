import { test } from "node:test";
import assert from "node:assert/strict";
import { atSpot, keyFourths, spot } from "./keyFourths";

const r = (o: object) => ({ play_id: 1, qtr: 3, clock: "07:00", posteam: "DET", down: 4, ydstogo: 2, yardline_100: 40, play_type: "run", home_wp: 0.4, home_wp_after: 0.52, ...o });

test("keeps regulation 4th downs that swung 10+ points", () => {
  const k = keyFourths([r({})], "DET", "KC");
  assert.equal(k.length, 1); assert.equal(k[0].swing, 12); assert.equal(k[0].toward, "DET"); assert.equal(k[0].call, "go");
});
test("drops small swings, non-4th downs, overtime, last 5 s of a half, and non-calls", () => {
  assert.equal(keyFourths([r({ home_wp_after: 0.45 })], "DET", "KC").length, 0);
  assert.equal(keyFourths([r({ down: 3 })], "DET", "KC").length, 0);
  assert.equal(keyFourths([r({ qtr: 5 })], "DET", "KC").length, 0);
  assert.equal(keyFourths([r({ qtr: 4, clock: "00:04" })], "DET", "KC").length, 0);
  assert.equal(keyFourths([r({ qtr: 2, clock: "00:05" })], "DET", "KC").length, 0);
  assert.equal(keyFourths([r({ qtr: 3, clock: "00:04" })], "DET", "KC").length, 1);
  assert.equal(keyFourths([r({ play_type: "no_play" })], "DET", "KC").length, 0);
});
test("spot text", () => {
  assert.equal(spot("DET", 66), "own 34"); assert.equal(spot("DET", 12), "opponent's 12"); assert.equal(spot("DET", 50), "midfield");
});
test("key 4th line says 'at their own', not 'at the own'", () => {
  assert.equal(atSpot("own 34"), " at their own 34");
  assert.equal(atSpot("opponent's 12"), " at the opponent's 12");
  assert.equal(atSpot("midfield"), " at midfield");
  assert.equal(atSpot(""), "");
});
