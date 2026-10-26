import test from "node:test";
import assert from "node:assert/strict";
import { DAILY_ITEMS } from "./daily";
import { CARD_SOURCE, cardImageUrl, cardPath, whatIfFor, xIntentUrl, pct } from "./whatIf";

const cards = DAILY_ITEMS.map(whatIfFor).filter((c) => c != null);

test("a card is prebuilt for every Daily item", () => {
  assert.equal(cards.length, DAILY_ITEMS.length);
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

test("every card links back to its exact situation", () => {
  for (const c of cards) {
    assert.equal(c.checkerHref, `/fourth-down/?play=${encodeURIComponent(c.id)}`);
    if (c.storyHref) assert.equal(c.storyHref, `/games/${c.gameId}/#play-${c.playId}`);
    assert.equal(cardPath(c.id), `/card/${encodeURIComponent(c.id)}/`);
    assert.ok(cardImageUrl(c.id).endsWith(`${cardPath(c.id)}card.png`));
  }
  assert.ok(cards.some((c) => c.storyHref), "story games have Game Story links");
});

test("share is an x.com/intent/post link carrying 'Data: nflverse' and the card URL", () => {
  for (const c of cards) {
    const u = new URL(xIntentUrl(c));
    assert.equal(u.origin + u.pathname, "https://x.com/intent/post");
    assert.ok(u.searchParams.get("text")!.includes(CARD_SOURCE));
    assert.ok(u.searchParams.get("url")!.endsWith(cardPath(c.id)));
  }
  assert.equal(CARD_SOURCE, "Data: nflverse");
});

test("no betting language on cards", () => {
  const bad = /\b(bet|bets|betting|odds|wager|spread|parlay|sportsbook|lock|cover)\b/i;
  for (const c of cards) assert.ok(!bad.test([c.headline, c.real, c.strip, c.game, xIntentUrl(c)].join(" ")), c.id);
});
