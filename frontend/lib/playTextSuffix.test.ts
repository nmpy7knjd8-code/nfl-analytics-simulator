import { test } from "node:test";
import assert from "node:assert/strict";
import { playText } from "./gamePlays";

test("name suffix keeps one period (Analyte 0320)", () => {
  assert.equal(playText({ display_text: "Baker Mayfield pass incomplete, intended for Chris Godwin Jr..", raw_desc: null }),
    "Baker Mayfield pass incomplete, intended for Chris Godwin Jr.");
  assert.equal(playText({ display_text: "Pass to Deebo Samuel Sr.. Flag down.", raw_desc: null }), "Pass to Deebo Samuel Sr. Flag down.");
  assert.equal(playText({ display_text: "Kick by Marvin Harrison III..", raw_desc: null }), "Kick by Marvin Harrison III.");
});

test("non-suffix '..' and ellipses are left alone", () => {
  assert.equal(playText({ display_text: "He runs for 4 yards..", raw_desc: null }), "He runs for 4 yards..");
  assert.equal(playText({ display_text: "Wait for it...", raw_desc: null }), "Wait for it...");
  assert.equal(playText({ display_text: "Ryan Jrrr..", raw_desc: null }), "Ryan Jrrr..");
  assert.equal(playText({ display_text: null, raw_desc: null }), null);
});
