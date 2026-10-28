import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHECKER_ENABLED, CHECKER_PAUSED } from "./features";

// H6 closed by #168 (calibration gate in CI); #170 turns the checker on. The paused copy must still never render numbers.
test("H6: checker is on after the #168 calibration gate; paused copy stays number-free", () => {
  assert.equal(CHECKER_ENABLED, true);
  assert.doesNotMatch(CHECKER_PAUSED.title + CHECKER_PAUSED.body, /\d+\s*%|\d+\s*pts?/);
  assert.equal(CHECKER_PAUSED.cta.href, "/");
});

test("nav and 404 links honour the flag", () => {
  for (const f of ["components/AppNav.tsx", "app/not-found.tsx", "app/fourth-down/page.tsx"]) {
    assert.match(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /CHECKER_ENABLED/, f);
  }
});
