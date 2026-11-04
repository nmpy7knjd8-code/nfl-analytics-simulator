import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { calibrationScore, readHard, writeHard, HARD_MODE_KEY } from "./hardMode";
import { dailySet } from "./daily";

test("calibration score: 1 − Brier, close call counts ½", () => {
  assert.equal(calibrationScore([{ confidence: 100, credit: 1 }]), 100);
  assert.equal(calibrationScore([{ confidence: 100, credit: 0 }]), 0);
  assert.equal(calibrationScore([{ confidence: 50, credit: 0 }]), 75);
  assert.equal(calibrationScore([{ confidence: 50, credit: 0.5 }]), 100);
  assert.equal(calibrationScore([]), null);
});

test("hard-mode flag round-trips and tolerates broken storage", () => {
  const m = new Map<string, string>();
  const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  assert.equal(readHard(st), false);
  writeHard(st, true); assert.equal(m.get(HARD_MODE_KEY), "1"); assert.equal(readHard(st), true);
  assert.equal(readHard({ getItem: () => { throw new Error("x"); } }), false);
});

// Published daily 5 must stay byte-identical with hard mode on (hashes taken from main before E6).
const PUBLISHED: Record<string, string> = {
  "2026-10-26": "aeff4ddb77384c0fa2622a9b2106eb2b76ae1a2a6a65e8fee35b3d6147534c38",
  "2026-10-27": "bd3a4a70c36dcd631eed22bafee3673be0a07d4860afcd5abeecbd8f49c8f9da",
  "2026-10-28": "ff22e7783503b57e8c3128dceb52658ad8332e97a184ce9b45bd4c39169166fc",
  "2026-10-29": "02c43df13f3f4f65edb4e08b9b3d19d53a83b77668369218ba2e84b507b4b5e1",
  "2026-10-30": "39600b3af2048f87aed58d956431ceea7ac190a0c3fb6298a55736a25e519b10",
  "2026-10-31": "0837717b6573054d1dcf05c50820fe978085d41e6b49f55694430deae1d699c0",
  "2026-11-01": "03ce39abda3ca93dfcff774916274bbb7e5a3fe46026bb07b207b42c3071cee4",
  "2026-11-02": "42d88991ffa46001807ed75bbb2156e952cddcbf72d7d74915362e2582eac5dc",
  "2026-11-03": "c2efdfb54cc504ed236b4a3c060f425055da8739da7aefdeb0d2f3ddd6059463",
};
test("published daily 5 are byte-identical with hard mode on", () => {
  const m = new Map([[HARD_MODE_KEY, "1"]]);
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem() {}, removeItem() {} };
  try {
    for (const [d, h] of Object.entries(PUBLISHED)) {
      assert.equal(createHash("sha256").update(JSON.stringify(dailySet(d))).digest("hex"), h, `daily ${d} changed`);
    }
  } finally { delete (globalThis as { localStorage?: unknown }).localStorage; }
});

import { readFileSync } from "node:fs";
import { gameItems, readConfs, writeConfs, calibrationText, HARD_CONFS_KEY } from "./hardMode";

test("rendered set: gameItems (what SimpleGame renders) matches the published hashes with Hard mode on and off", () => {
  const src = readFileSync(new URL("../components/SimpleGame.tsx", import.meta.url), "utf8");
  assert.match(src, /useMemo\(\(\) => gameItems\(mode, key, seed\), \[key, mode, seed\]\)/, "SimpleGame must render gameItems with no Hard-mode input");
  assert.equal(gameItems.length, 3);
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem() {} };
  try {
    for (const on of ["0", "1"]) {
      m.set(HARD_MODE_KEY, on);
      for (const [d, h] of Object.entries(PUBLISHED)) {
        assert.equal(createHash("sha256").update(JSON.stringify(gameItems("daily", d, ""))).digest("hex"), h, `daily ${d} changed (hard=${on})`);
      }
    }
  } finally { delete (globalThis as { localStorage?: unknown }).localStorage; }
});

test("confidence answers survive a reload (saved per day) and need all 5 for a score", () => {
  const m = new Map<string, string>();
  const st = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
  writeConfs(st, "2026-11-03", [80, 60, 100]);
  assert.deepEqual(readConfs(st, "2026-11-03"), [80, 60, 100]);
  assert.deepEqual(readConfs(st, "2026-11-04"), [], "a new day starts fresh");
  m.set(HARD_CONFS_KEY, "{bad"); assert.deepEqual(readConfs(st, "2026-11-03"), []);
  assert.deepEqual(readConfs({ getItem: () => { throw new Error("x"); } }, "2026-11-03"), []);
  assert.equal(calibrationText([80, 60, 100], [1, 1, 1, 1, 1]), "Calibration needs all 5 answers.");
  assert.match(calibrationText([100, 100, 100, 100, 100], [1, 1, 1, 1, 1])!, /^Hard mode calibration: 100\/100/);
});
