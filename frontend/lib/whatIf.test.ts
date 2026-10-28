import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_ITEMS } from "./daily";
import { CARD_SOURCE, cardPath, whatIfFor, xIntentUrl, pct } from "./whatIf";

const cards = DAILY_ITEMS.map(whatIfFor).filter((c) => c != null);

test("cards exist for the Daily pack, never for overtime plays", () => {
  assert.ok(cards.length > 0);
  for (const i of DAILY_ITEMS) if (i.situation.qtr > 4) assert.equal(whatIfFor(i), null, i.id);
});

test("card numbers are the engine values in the pack, for the real call and the other one", () => {
  for (const c of cards) {
    const item = DAILY_ITEMS.find((i) => i.id === c.id)!;
    assert.equal(c.actual, item.historical_action);
    assert.notEqual(c.alt, c.actual);
    assert.equal(c.from, item.reveal.values[c.actual]);
    assert.equal(c.to, item.reveal.values[c.alt]);
    assert.equal(c.team, item.situation.posteam);
    assert.ok(c.headline.includes(`${pct(c.from)} → ${pct(c.to)}`));
  }
});

test("share is an x.com/intent/post link carrying 'Data: nflverse' and the card URL", () => {
  for (const c of cards) {
    const u = new URL(xIntentUrl(c));
    assert.equal(u.origin + u.pathname, "https://x.com/intent/post");
    assert.ok(u.searchParams.get("text")!.includes(CARD_SOURCE));
    assert.ok(u.searchParams.get("url")!.endsWith(cardPath(c.id)));
  }
});

test("no betting language or EPA/WPA/xpass on cards", () => {
  const bad = /\b(bet|bets|betting|odds|wager|spread|parlay|sportsbook|lock|cover|epa|wpa|xpass)\b/i;
  for (const c of cards) assert.ok(!bad.test([c.headline, c.real, c.strip, c.game, xIntentUrl(c)].join(" ")), c.id);
});
