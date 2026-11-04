import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { gameDrives, isDrivesFile, parseDrive, RESULT_LABEL, TILE_LABEL, driveAria, qtrLabel } from "./drives";

const SEASONS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

test("F7: public/data/drives copies match data/site/drives byte for byte", () => {
  assert.deepEqual(readdirSync(new URL("../public/data/drives/", import.meta.url)).sort(), SEASONS.map((s) => `${s}.json`));
  for (const s of SEASONS) {
    const a = readFileSync(new URL(`../public/data/drives/${s}.json`, import.meta.url));
    const b = readFileSync(new URL(`../../data/site/drives/${s}.json`, import.meta.url));
    assert.ok(a.equals(b), `${s} differs`);
  }
});

test("F7: every drive string parses, every code has a fan label, plays = tiles", () => {
  let games = 0;
  for (const s of SEASONS) {
    const f = JSON.parse(readFileSync(new URL(`../public/data/drives/${s}.json`, import.meta.url), "utf8"));
    assert.ok(isDrivesFile(f) && f.season === s && typeof f.dataThrough === "string");
    for (const [id, list] of Object.entries<string[]>(f.games)) {
      games++;
      assert.equal(gameDrives(f, id).length, list.length, id);
    }
    for (const k of Object.keys(f.result_key)) assert.ok(RESULT_LABEL[k], k);
    for (const k of Object.keys(f.tile_key)) assert.ok(k in TILE_LABEL, k);
  }
  assert.equal(games, 1960);
  const d = parseDrive("NO 5 10:00 83 DN FFGGFNGFFNNGG")!;
  assert.equal(d.tiles.length, 13);
  assert.equal(qtrLabel(d.qtr), "OT");
  assert.equal(parseDrive("bad"), null);
  assert.equal(driveAria(d, (t) => t), "NO drive, OT 10:00: 13 plays, 83 yards, Turnover on downs");
});

test("F7: drive strip UI has no model or betting wording and no chart lines", () => {
  const src = ["../components/DriveStrips.tsx", "./drives.ts"].map((p) => readFileSync(new URL(p, import.meta.url), "utf8")).join("\n");
  assert.doesNotMatch(src, /\b(EPA|WPA|xpass|expected points|win prob|odds|spread|bet|vegas)\b/i);
  assert.doesNotMatch(readFileSync(new URL("../components/DriveStrips.tsx", import.meta.url), "utf8"), /<svg|homeWp|winLine/);
});

test("F7: end-of-half code reads End of game in Q4 and OT", async () => {
  const { resultLabel } = await import("./drives");
  assert.equal(resultLabel("EH", 2), "End of half");
  assert.equal(resultLabel("EH", 4), "End of game");
});

test("F7: result code OD (renamed from OT by Data Builders) reads the same as OT", async () => {
  const { resultLabel } = await import("./drives");
  assert.equal(resultLabel("OD"), "Other team scored");
  assert.equal(resultLabel("OD"), resultLabel("OT"));
  assert.equal(parseDrive("BUF 3 07:53 0 OD GX")?.result, "OD");
});

test("OD drives carry an appended return-type letter; other drives parse unchanged", () => {
  assert.deepEqual(parseDrive("ARI 2 10:00 5 OD GX I")?.ret, "I");
  assert.equal(parseDrive("ARI 2 10:00 5 OD GX I")?.tiles.join(""), "GX");
  assert.equal(parseDrive("ARI 1 15:00 70 TD GFGT")?.ret, undefined);
  assert.equal(parseDrive("ARI 2 10:00 5 OD GX Z"), null);
});
