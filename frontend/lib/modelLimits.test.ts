import { test } from "node:test";
import assert from "node:assert/strict";
import { DAILY_ITEMS, optionStates } from "./daily";
import { limitsFor } from "./modelLimits";

const BANNED = /\b(epa|wpa|xpass|odds|spread|vegas|bet|cover)\b/i;
test("every daily item shows at least one limit, no banned words", () => {
  for (const it of DAILY_ITEMS) {
    const l = limitsFor(it);
    assert.ok(l.length >= 1);
    for (const x of l) assert.ok(!BANNED.test(x.text), x.text);
  }
});
test("kicker limit only when a kick is offered; weather hidden indoors", () => {
  for (const it of DAILY_ITEMS) {
    const kick = optionStates(it).some((o) => o.id === "fg" && !o.disabled);
    assert.equal(limitsFor(it).some((x) => x.id === "kicker"), kick);
    assert.ok(!limitsFor(it, { roof: "dome" }).some((x) => x.id === "weather"));
  }
});
