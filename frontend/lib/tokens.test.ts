import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iosChart, iosColor, iosFonts, iosMetrics, iosRadius, iosSpace, iosType } from "./tokens";

const css = readFileSync(new URL("../app/tokens.css", import.meta.url), "utf8");
const ts = readFileSync(new URL("./tokens.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/ios-shell.css", import.meta.url), "utf8");

test("touch targets are at least 44px", () => {
  assert.ok(iosMetrics.touch >= 44);
  assert.ok(iosMetrics.navHeight >= 44);
  assert.match(css, /--ios-touch:\s*44px/);
});

test("font stack is SF-like and does not lead with Inter or Roboto", () => {
  assert.match(iosFonts.text, /-apple-system/);
  assert.match(iosFonts.text, /BlinkMacSystemFont/);
  assert.match(iosFonts.text, /SF Pro/);
  assert.match(iosFonts.display, /-apple-system/);
  assert.doesNotMatch(iosFonts.text, /^Inter|^Roboto|^Arial/);
});

test("light and dark palettes differ and share the same keys", () => {
  assert.deepEqual(Object.keys(iosColor.light), Object.keys(iosColor.dark));
  assert.notEqual(iosColor.light.backgroundPrimary, iosColor.dark.backgroundPrimary);
  assert.notEqual(iosColor.light.labelPrimary, iosColor.dark.labelPrimary);
  assert.equal(iosColor.light.accent, "#007aff");
  assert.equal(iosColor.dark.accent, "#0a84ff");
  assert.equal(iosChart.light.series.length, 4);
  assert.equal(iosChart.dark.series.length, 4);
});

test("CSS variables stay in sync with a handful of TS values", () => {
  assert.match(css, new RegExp(`--ios-accent:\\s*${iosColor.light.accent}`, "i"));
  assert.match(css, /\[data-theme="dark"\][\s\S]*--ios-accent:\s*#0a84ff/i);
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /--ios-space-4:\s*16px/);
  assert.equal(iosSpace[4], 16);
  assert.equal(iosRadius.xl, 20);
  assert.equal(iosType.largeTitle, "2.125rem");
});

test("house-rule words stay out of token names and shell CSS", () => {
  const blob = `${css}\n${ts}\n${shell}`;
  assert.doesNotMatch(blob, /\bEPA\b/);
  assert.doesNotMatch(blob, /\bWPA\b/);
  assert.doesNotMatch(blob, /\bbetting\b/i);
  assert.doesNotMatch(blob, /\bmoneyline\b/i);
  assert.doesNotMatch(blob, /\bover\/under\b/i);
});

test("opt-in shell classes exist and respect reduced motion", () => {
  for (const cls of [".ios-topbar", ".ios-tabbar", ".ios-card", ".ios-list", ".ios-large-title", ".ios-footer-note"]) {
    assert.ok(shell.includes(cls), cls);
  }
  assert.match(shell, /prefers-reduced-motion:\s*reduce/);
  assert.match(shell, /backdrop-filter/);
});
