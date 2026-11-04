import { test } from "node:test";
import assert from "node:assert/strict";
import * as fixtures from "./fixtures";

// FG distance = yardline_100 + 18 (nflverse); kicks over 64 yd are never offered.
test("no 4th-down demo offers a field goal beyond 64 yards", () => {
  const scenarios = Object.values(fixtures).find(
    (v) => Array.isArray(v) && v.some((s: any) => typeof s?.id === "string" && s.id.startsWith("demo-4th")),
  ) as any[];
  assert.ok(scenarios?.length, "found 4th-down demo scenarios");
  for (const s of scenarios) {
    if (s.options.some((o: any) => o.id === "fg")) {
      assert.ok(s.situation.yardline_100 + 18 <= 64, `${s.id}: ${s.situation.yardline_100 + 18}-yd FG`);
    }
  }
});
