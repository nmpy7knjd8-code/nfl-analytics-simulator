import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSnapshotArgs } from "./snapshotArgs";

const D = "2026-10-30";
test("no args (nightly workflow): default date, bundled pack", () => {
  assert.deepEqual(parseSnapshotArgs([], D), { packPath: undefined, until: D });
});
test("positional date without --pack is used (was ignored)", () => {
  assert.deepEqual(parseSnapshotArgs(["2026-10-31"], D), { packPath: undefined, until: "2026-10-31" });
});
test("date with --pack, either order", () => {
  assert.deepEqual(parseSnapshotArgs(["2026-10-31", "--pack", "p.json"], D), { packPath: "p.json", until: "2026-10-31" });
  assert.deepEqual(parseSnapshotArgs(["--pack", "p.json", "2026-10-31"], D), { packPath: "p.json", until: "2026-10-31" });
});
test("--pack value is never taken as the date", () => {
  assert.deepEqual(parseSnapshotArgs(["--pack", "2026-11-01"], D), { packPath: "2026-11-01", until: D });
});
