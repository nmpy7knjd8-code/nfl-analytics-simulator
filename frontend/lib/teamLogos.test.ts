import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import manifestRaw from "../public/teams/manifest.json";
import contractCopy from "../contracts/teamLogos.json";
import teamColors from "./teamColors.json";
import type { TeamLogoManifest } from "../contracts/teamLogos";

const manifest = manifestRaw as TeamLogoManifest;
const PUBLIC = join(__dirname, "..", "public");
const TEAMS = Object.keys((teamColors as { teams: Record<string, unknown> }).teams).sort();

test("manifest covers exactly the 32 current teams and credits its source", () => {
  assert.equal(TEAMS.length, 32);
  assert.deepEqual(Object.keys(manifest.teams).sort(), TEAMS);
  assert.match(manifest._source, /nflverse/);
  assert.match(manifest._source, /ESPN/);
  assert.match(manifest.fetched, /^\d{4}-\d{2}-\d{2}$/);
  assert.deepEqual(contractCopy, manifestRaw);
});

test("every team has a non-empty self-hosted logo and wordmark at the manifest path", () => {
  for (const abbr of TEAMS) {
    for (const kind of ["logo", "wordmark"] as const) {
      const f = manifest.teams[abbr][kind];
      assert.equal(f.path, `/teams/${abbr}/${kind}.png`);
      const disk = join(PUBLIC, f.path);
      assert.ok(existsSync(disk), `${disk} missing`);
      const size = statSync(disk).size;
      assert.ok(size > 0 && size === f.bytes, `${disk} size ${size} != ${f.bytes}`);
      assert.equal(readFileSync(disk).subarray(1, 4).toString(), "PNG");
      assert.match(f.source_url, /^https:\/\//);
    }
  }
});
