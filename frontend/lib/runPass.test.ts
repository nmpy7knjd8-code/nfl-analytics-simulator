import { test } from "node:test";
import assert from "node:assert/strict";
import { RUN_PASS_4TH_1, runPassVerdict, showsRunPassBonus } from "./runPass";

test("only Go on 4th-and-1, not goal to go", () => {
  assert.equal(showsRunPassBonus("go", 1, false), true);
  assert.equal(showsRunPassBonus("punt", 1, false), false);
  assert.equal(showsRunPassBonus("fg", 1, false), false);
  assert.equal(showsRunPassBonus("go", 2, false), false);
  assert.equal(showsRunPassBonus("go", 1, true), false);
});
test("numbers match verify_out.txt", () => {
  assert.deepEqual(RUN_PASS_4TH_1.run, { pct: 71.4, tries: 1629 });
  assert.deepEqual(RUN_PASS_4TH_1.pass, { pct: 54.3, tries: 549 });
});
test("verdicts cite both rates", () => {
  for (const g of ["run", "pass"] as const) assert.match(runPassVerdict(g), /71\.4%.*54\.3%/);
});
