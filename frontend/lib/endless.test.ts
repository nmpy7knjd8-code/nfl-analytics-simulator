import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_ITEMS, scoreCall } from "./daily";
import { ENDLESS_STORAGE_KEY, accuracyText, addEndless, emptyEndless, loadEndless, nextEndless, resetEndless, saveEndless, tallyText } from "./endless";

function mem() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
const byId = (id: string) => DAILY_ITEMS.find((i) => i.id === id)!;

test("no repeats within a session until the whole pool is used", () => {
  const seen = new Set<string>();
  let r = 0.123;
  const rand = () => (r = (r * 9301 + 49297) % 233280 / 233280);
  for (let i = 0; i < DAILY_ITEMS.length; i++) {
    const it = nextEndless(seen, rand)!;
    assert.ok(!seen.has(it.id), `repeat at ${i}`);
    seen.add(it.id);
  }
  assert.equal(seen.size, DAILY_ITEMS.length);
  const again = nextEndless(seen, rand, DAILY_ITEMS, "x")!;
  assert.ok(again, "keeps serving after the pool is exhausted (no limit)");
  const small = [DAILY_ITEMS[0], DAILY_ITEMS[1]];
  assert.notEqual(nextEndless(new Set(small.map((i) => i.id)), () => 0, small, small[0].id)!.id, small[0].id);
  assert.equal(nextEndless(new Set(), Math.random, []), null, "empty pool → empty state");
});

test("accuracy uses the daily scoring rules: tie = full, close = ½", () => {
  let s = emptyEndless();
  assert.equal(accuracyText(s), "–");
  const car = byId("2022_03_NO_CAR-2560"); // Go and Kick tie at the shown %
  const ne = byId("2022_03_BAL_NE-819"); // FG is the close-call pick
  const det = byId("2023_01_DET_KC-1986"); // Punt is wrong
  s = addEndless(s, scoreCall("fg", car));
  s = addEndless(s, scoreCall("go", car));
  s = addEndless(s, scoreCall("fg", ne));
  s = addEndless(s, scoreCall("punt", det));
  assert.deepEqual(s, { credit: 2.5, total: 4 });
  assert.equal(accuracyText(s), "63%");
  assert.equal(tallyText(s), "2.5 of 4");
});

test("score persists across sessions, survives junk, and resets", () => {
  const st = mem();
  assert.deepEqual(loadEndless(st), emptyEndless());
  saveEndless(st, { credit: 3.5, total: 5 });
  assert.deepEqual(loadEndless(st), { credit: 3.5, total: 5 });
  st.setItem(ENDLESS_STORAGE_KEY, "{bad");
  assert.deepEqual(loadEndless(st), emptyEndless());
  st.setItem(ENDLESS_STORAGE_KEY, JSON.stringify({ credit: 9, total: 2 }));
  assert.deepEqual(loadEndless(st), emptyEndless());
  saveEndless(st, { credit: 1, total: 1 });
  assert.deepEqual(resetEndless(st), emptyEndless());
  assert.equal(st.m.has(ENDLESS_STORAGE_KEY), false);
  assert.deepEqual(loadEndless(undefined), emptyEndless());
});
