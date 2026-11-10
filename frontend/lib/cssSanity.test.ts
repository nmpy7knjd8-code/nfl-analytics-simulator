import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Guards against find-and-replace damage like "0.62.25rem" (#102).
const files = ["app", "components"].flatMap((d) =>
  readdirSync(join(process.cwd(), d), { recursive: true }).map(String).filter((f) => f.endsWith(".css")).map((f) => join(d, f)),
);

test("no mangled CSS numbers like 0.62.25rem", () => {
  assert.ok(files.includes(join("app", "globals.css")));
  for (const f of files) {
    const bad = readFileSync(join(process.cwd(), f), "utf8").split("\n")
      .map((l, i) => [i + 1, l] as const).filter(([, l]) => /\d+\.\d+\.\d+(rem|px|em)/.test(l));
    assert.deepEqual(bad, [], `${f} has mangled values`);
  }
});

test("QA 0217 K/J/menu: About kick copy matches the game; every logo has a plate; menu links", async () => {
  const { readFileSync } = await import("node:fs");
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
  assert.match(read("../app/about/page.tsx"), /Too far to kick \(65\+ yards\)/);
  assert.match(read("../components/SimpleGame.tsx"), /Too far to kick \(65\+ yards\)/);
  assert.match(read("../components/TeamLogo.tsx"), /className="team-logo team-logo-plate"/);
  const sg = read("../components/SiteMenu.tsx");
  assert.match(sg, /<SiteMenuLinks \/>/);
  // PR #176 regression: one ☰ menu pattern; TopBar must not render all links inline.
  assert.match(read("../components/SimpleGame.tsx"), /<SiteMenu \/>/);
  const appNav = read("../components/AppNav.tsx");
  assert.match(appNav, /<SiteMenu \/>/);
  assert.doesNotMatch(appNav, /<SiteMenuLinks \/>/);
  assert.match(sg, /key === "Escape"/);
  const css = read("../app/globals.css");
  assert.match(css, /\.fd-brand \{[^}]*white-space: nowrap;[^}]*flex-shrink: 0;/);
  assert.doesNotMatch(css, /\.fd-top-links/);
  assert.match(read("../app/simple-game.css"), /\.sg-menu-list\{[^}]*overflow-y:auto;max-height:/);
  for (const href of ["/practice/", "/endless/", "/feed/", "/kicks/", "/games/", "/daily/stats/", "/about/", "/first-down/"]) assert.ok(sg.includes(`<Link href="${href}">`), href);
});

test("QA S7: ☰ menu and top bar stack above /feed chips; footer stays below the menu", () => {
  const tokens = readFileSync(new URL("../app/tokens.css", import.meta.url), "utf8");
  const sg = readFileSync(new URL("../app/simple-game.css", import.meta.url), "utf8");
  const globals = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const nav = Number(tokens.match(/--ios-z-nav:\s*(\d+)/)?.[1]);
  assert.equal(nav, 40);

  const bodyOf = (css: string, sel: string) => {
    const re = new RegExp("(?:^|[}\\n])" + sel.replace(/[.]/g, "\\.") + "\\s*\\{([^}]*)\\}", "g");
    const ms = [...css.matchAll(re)];
    assert.ok(ms.length, `missing rule ${sel}`);
    return ms.map((m) => m[1]).join(";");
  };
  const zOf = (css: string, sel: string) => {
    const body = bodyOf(css, sel);
    const raw = body.match(/z-index:\s*([^;]+)/)?.[1]?.trim();
    if (!raw) return 0;
    if (raw === "var(--ios-z-nav)") return nav;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
  };

  const top = zOf(sg, ".sg-top");
  const menu = zOf(sg, ".sg-menu-list");
  const fd = zOf(globals, ".fd-top");
  const chips = zOf(sg, ".pf-chips");
  const footer = zOf(sg, ".sg-tm-note");
  assert.ok(top > chips, `sg-top z ${top} should exceed pf-chips ${chips}`);
  assert.ok(menu > chips, `sg-menu-list z ${menu} should exceed pf-chips ${chips}`);
  assert.ok(fd > chips, `fd-top z ${fd} should exceed pf-chips ${chips}`);
  assert.match(bodyOf(sg, ".sg-top"), /position:\s*relative/);
  assert.match(bodyOf(globals, ".fd-top"), /position:\s*relative/);

  assert.ok(footer > 0 && footer < nav, `footer z ${footer} must sit above page content and below --ios-z-nav ${nav}`);
  // The footer inherits .sg-app's background (hardcoded #fff). A token like
  // --ios-background-secondary turns dark (#1c1c1e) in dark mode and left a 2.8:1 strip.
  assert.match(bodyOf(sg, ".sg-tm-note"), /background:\s*inherit/);
  assert.doesNotMatch(bodyOf(sg, ".sg-tm-note"), /background:\s*var\(--ios-/);
  assert.match(bodyOf(sg, ".sg-tm-note"), /position:\s*relative/);
  assert.match(bodyOf(sg, ".sg-tm-note"), /flex:\s*none/);
  assert.doesNotMatch(bodyOf(sg, ".sg-tm-note"), /background:\s*#fff/);

  const list = bodyOf(sg, ".pf-list");
  assert.match(list, /overflow-x:\s*hidden/);
  assert.match(list, /overflow-y:\s*auto/);
  assert.match(list, /isolation:\s*isolate/);
  assert.doesNotMatch(list, /padding-bottom/);
});
