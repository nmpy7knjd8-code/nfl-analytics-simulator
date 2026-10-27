import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHECKER_ENABLED, CHECKER_PAUSED } from "./features";

// Guard: while H6 is open the checker must stay off and the paused page must not render any numbers.
test("H6: 4th-down checker is off on the live site", () => {
  assert.equal(CHECKER_ENABLED, false);
  assert.doesNotMatch(CHECKER_PAUSED.title + CHECKER_PAUSED.body, /\d+\s*%|\d+\s*pts?/);
  assert.equal(CHECKER_PAUSED.cta.href, "/daily/");
});

test("nav and 404 links honour the flag", () => {
  for (const f of ["components/AppNav.tsx", "app/not-found.tsx", "app/fourth-down/page.tsx", "components/DailyGame.tsx"]) {
    assert.match(readFileSync(new URL(`../${f}`, import.meta.url), "utf8"), /CHECKER_ENABLED/, f);
  }
});
