import { test } from "node:test";
import assert from "node:assert/strict";
import { IOS_TABS, IOS_TABS_4, IOS_TABS_5, normPath } from "./iosTabs";

test("default tab set is Today / Feed / Games / More", () => {
  assert.equal(IOS_TABS, IOS_TABS_4);
  assert.deepEqual(IOS_TABS.map((t) => t.label), ["Today", "Feed", "Games", "More"]);
  assert.ok(!IOS_TABS.some((t) => t.label === "Practice"));
});

test("5-tab candidate has five short labels and is a one-line swap", () => {
  assert.equal(IOS_TABS_5.length, 5);
  assert.deepEqual(IOS_TABS_5.map((t) => t.label), ["Today", "Feed", "Games", "Stats", "Explore"]);
  for (const t of IOS_TABS_5) assert.ok(t.label.length <= 8);
});

test("path matching covers hub, overflow, and trailing slashes", () => {
  const by = Object.fromEntries(IOS_TABS.map((t) => [t.label, t]));
  assert.equal(normPath("/more/"), "/more");
  assert.ok(by.Today.match("/"));
  assert.ok(by.Today.match("/daily"));
  assert.ok(!by.Today.match("/daily/stats"));
  assert.ok(by.Feed.match("/feed/"));
  assert.ok(by.Games.match("/games/xyz"));
  assert.ok(by.More.match("/more"));
  assert.ok(by.More.match("/explore/"));
  assert.ok(by.More.match("/about"));
  assert.ok(by.More.match("/team"));
  assert.ok(by.More.match("/team/KC"));
  assert.ok(by.More.match("/rivalry/"));
  assert.ok(by.More.match("/playoffs/2025"));
  assert.ok(by.More.match("/coaches"));
  assert.ok(!by.More.match("/practice"));
  assert.ok(by.Today.match("/practice"));
  assert.ok(!by.More.match("/"));
  assert.ok(!by.More.match("/feed"));
});
