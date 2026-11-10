import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iosChart, iosColor, iosFonts, iosMaterial, iosMetrics, iosRadius, iosSpace, iosType, iosWeight } from "./tokens";

const css = readFileSync(new URL("../app/tokens.css", import.meta.url), "utf8");
const ts = readFileSync(new URL("./tokens.ts", import.meta.url), "utf8");
const shell = readFileSync(new URL("../app/ios-shell.css", import.meta.url), "utf8");
const blob = `${css}\n${ts}\n${shell}`;

test("touch targets are at least 44px", () => {
  assert.ok(iosMetrics.touch >= 44);
  assert.ok(iosMetrics.navHeight >= 44);
  assert.match(css, /--ios-touch:\s*44px/);
});

test("font stack is SF-like and does not include Inter or Roboto", () => {
  assert.match(iosFonts.text, /-apple-system/);
  assert.match(iosFonts.text, /BlinkMacSystemFont/);
  assert.match(iosFonts.text, /SF Pro/);
  assert.match(iosFonts.display, /-apple-system/);
  assert.doesNotMatch(iosFonts.text, /Inter|Roboto/);
  assert.doesNotMatch(iosFonts.display, /Inter|Roboto/);
  assert.doesNotMatch(css, /--ios-font-(text|display):[^;]*Inter|--ios-font-(text|display):[^;]*Roboto/);
});

test("one accent blue, locked by theme, with no second blue or sports palette", () => {
  assert.deepEqual(Object.keys(iosColor.light), Object.keys(iosColor.dark));
  assert.notEqual(iosColor.light.backgroundPrimary, iosColor.dark.backgroundPrimary);
  assert.equal(iosColor.light.accent, "#007aff");
  assert.equal(iosColor.dark.accent, "#0a84ff");
  assert.match(css, /--ios-accent:\s*#007aff/i);
  assert.match(css, /\[data-theme="dark"\][\s\S]*--ios-accent:\s*#0a84ff/i);
  assert.doesNotMatch(blob, /#1e5bff/i);
  assert.doesNotMatch(blob, /#34c759|#30d158|#ff9f0a|#ffd60a|#af52de|#bf5af2/i);
  assert.doesNotMatch(blob, /--ios-success|--ios-warning|--ios-danger|success:|warning:|danger:/);
  assert.equal(iosColor.light.red, "#ff3b30");
  assert.equal(iosColor.dark.red, "#ff453a");
  assert.match(css, /--ios-red:\s*#ff3b30/i);
  assert.doesNotMatch(blob, /--ios-(bal|cle|team)|#241773/i);
});

test("chart series are accent tints plus gray", () => {
  assert.equal(iosChart.light.series.length, 4);
  assert.equal(iosChart.dark.series.length, 4);
  assert.equal(iosChart.light.series[0], iosColor.light.accent);
  assert.equal(iosChart.dark.series[0], iosColor.dark.accent);
  assert.equal(iosChart.light.series[3], "#8e8e93");
  assert.equal(iosChart.dark.series[3], "#8e8e93");
  for (const hex of [...iosChart.light.series, ...iosChart.dark.series]) {
    assert.doesNotMatch(hex, /#34c759|#30d158|#ff9f0a|#ffd60a|#af52de|#bf5af2|#ff3c00|#241773/i);
  }
});

test("tabular numbers and weight tokens are exported and used", () => {
  assert.equal(iosFonts.nums, "tabular-nums");
  assert.match(css, /--ios-nums:\s*tabular-nums/);
  assert.match(shell, /\.ios-nums\s*\{[^}]*font-variant-numeric:\s*var\(--ios-nums\)/);
  assert.deepEqual(iosWeight, { regular: 400, medium: 500, semibold: 600, bold: 700 });
  assert.match(css, /--ios-weight-regular:\s*400/);
  assert.match(css, /--ios-weight-medium:\s*500/);
  assert.match(css, /--ios-weight-semibold:\s*600/);
  assert.match(css, /--ios-weight-bold:\s*700/);
  assert.equal(iosType.headline, "1.0625rem");
  assert.equal(iosType.headlineWeight, 600);
  assert.equal(iosType.largeTitle, "2.125rem");
  assert.equal(iosType.largeTitleWeight, 700);
  assert.match(css, /--ios-text-headline-weight:\s*var\(--ios-weight-semibold\)/);
  assert.match(css, /--ios-text-large-title-weight:\s*var\(--ios-weight-bold\)/);
  assert.match(shell, /\.ios-large-title[\s\S]*?font-weight:\s*var\(--ios-text-large-title-weight\)/);
  assert.match(shell, /\.ios-headline[\s\S]*?font-weight:\s*var\(--ios-text-headline-weight\)/);
});

test("CSS variables stay in sync with a handful of TS values", () => {
  assert.match(css, /prefers-color-scheme:\s*dark/);
  assert.match(css, /--ios-space-4:\s*16px/);
  assert.match(css, /--ios-space-9:\s*48px/);
  assert.equal(iosSpace[4], 16);
  assert.equal(iosSpace[9], 48);
  assert.equal(iosRadius.lg, 16);
  assert.equal(iosRadius.xl, 20);
  assert.equal(iosRadius.md, 12);
  assert.match(shell, /\.ios-card\s*\{[^}]*border-radius:\s*var\(--ios-radius-lg\)/);
  assert.match(shell, /\.ios-sheet\s*\{[^}]*border-radius:\s*var\(--ios-radius-xl\)/);
  assert.match(shell, /\.ios-button\s*\{[^}]*min-height:\s*var\(--ios-touch\)/);
  assert.match(shell, /\.ios-button\s*\{[^}]*border-radius:\s*var\(--ios-radius-md\)/);
  assert.match(shell, /\.ios-button(?:-pill|\.is-pill|\.ios-button-pill)/);
  assert.match(shell, /\.ios-footer-note\s*\{[^}]*font-size:\s*var\(--ios-text-footnote\)/);
  assert.equal(iosMaterial.blur, "20px");
  assert.equal(iosMaterial.saturate, "180%");
  assert.match(css, /--ios-material-blur:\s*20px/);
  assert.match(css, /--ios-material-saturate:\s*180%/);
  assert.match(shell, /\.ios-topbar\s*\{[^}]*backdrop-filter:\s*saturate\(var\(--ios-material-saturate\)\)\s*blur\(var\(--ios-material-blur\)\)/);
  assert.match(shell, /\.ios-topbar\s*\{[^}]*border-bottom:\s*0\.5px\s*solid\s*var\(--ios-separator\)/);
});

test("house-rule words stay out of token names and shell CSS", () => {
  assert.doesNotMatch(blob, /\bEPA\b/);
  assert.doesNotMatch(blob, /\bWPA\b/);
  assert.doesNotMatch(blob, /\bbetting\b/i);
  assert.doesNotMatch(blob, /\bmoneyline\b/i);
  assert.doesNotMatch(blob, /\bover\/under\b/i);
});

test("opt-in shell classes exist and respect reduced motion", () => {
  for (const cls of [".ios-topbar", ".ios-tabbar", ".ios-card", ".ios-list", ".ios-large-title", ".ios-footer-note", ".ios-button", ".ios-sheet", ".ios-nums", ".ios-headline"]) {
    assert.ok(shell.includes(cls), cls);
  }
  assert.match(shell, /prefers-reduced-motion:\s*reduce/);
  assert.match(shell, /backdrop-filter/);
});
