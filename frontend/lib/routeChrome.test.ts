// Route chrome guard (HGIC, Oct 28): every route under app/ must use the
// Fourth & Daily design (SimpleGame <Header> with the ☰ menu, <Trademark>
// footer, old chrome hidden via useGameRoute) and none of the old dark theme
// or bottom-nav markers. Reference: SimpleGame, /feed (PlayFeedC6), /kicks (#159).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(FRONTEND, "app");

// Pre-existing routes still on the old shell. Shrink this list; never grow it.
const LEGACY_ROUTES = new Set<string>([]);

// Old dark theme / old chrome markers (globals.css :root dark tokens, .fd-page, TopBar, bottom nav).
const DARK_MARKERS: [RegExp, string][] = [
  [/\bfd-page\b/, "old dark page class .fd-page"],
  [/var\(--color-(bg|ink|border|accent)/, "old dark theme tokens var(--color-*)"],
  [/\bapp-nav\b/, "old bottom nav .app-nav"],
  [/\bfd-top\b/, "old top bar .fd-top"],
  [/<AppNav\b|<TopBar\b/, "old AppNav/TopBar chrome"],
];

function pages(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return pages(p);
    return n === "page.tsx" ? [p] : [];
  });
}

const routeOf = (file: string) => "/" + relative(APP, dirname(file)).split("\\").join("/").replace(/^\.?$/, "");

function resolveImport(from: string, spec: string): string | null {
  if (!spec.startsWith(".")) return null;
  const base = resolve(dirname(from), spec);
  for (const c of [base, base + ".tsx", base + ".ts", join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

/** Page source plus every local .tsx/.ts/.css it imports (transitively), excluding lib data and globals. */
function sources(entry: string): Map<string, string> {
  const out = new Map<string, string>();
  const todo = [entry];
  while (todo.length) {
    const f = todo.pop()!;
    if (out.has(f) || f.endsWith(".json") || f.endsWith("globals.css")) continue;
    const src = readFileSync(f, "utf8");
    out.set(f, src);
    if (f.endsWith(".css")) continue;
    for (const m of src.matchAll(/(?:import|from)\s+["']([^"']+)["']/g)) {
      const r = resolveImport(f, m[1]);
      if (r && (r.includes(`${join(FRONTEND, "components")}`) || r.startsWith(APP))) todo.push(r);
    }
  }
  return out;
}

const appNav = readFileSync(join(FRONTEND, "components", "AppNav.tsx"), "utf8");
const gameRouteBody = appNav.match(/function useGameRoute[\s\S]*?\n}/)?.[0] ?? "";

const ROUTES = pages(APP).map((f) => ({ file: f, route: routeOf(f) }));

test("legacy route allowlist only lists routes that still exist", () => {
  const live = new Set(ROUTES.map((r) => r.route));
  for (const r of LEGACY_ROUTES) assert.ok(live.has(r), `${r} is gone; remove it from LEGACY_ROUTES`);
});

for (const { file, route } of ROUTES) {
  if (LEGACY_ROUTES.has(route)) continue;
  test(`route ${route} uses the Fourth & Daily chrome`, () => {
    const srcs = sources(file);
    const all = [...srcs.values()].join("\n");
    const problems: string[] = [];
    if (!/<Header\b/.test(all) || !all.includes("☰") && !/from\s+["'][./]+(components\/)?SimpleGame["']/.test(all))
      problems.push("missing the Fourth & Daily <Header> with the ☰ menu (import { Header } from SimpleGame)");
    if (!/<Trademark\b/.test(all)) problems.push("missing the <Trademark /> footer");
    if (!gameRouteBody.includes(`"${route.replace(/\[[^\]]+\]/g, "").replace(/\/+/g, "/")}`))
      problems.push(`not in AppNav useGameRoute(), so the old top bar and bottom nav still render on ${route}`);
    for (const [f, src] of srcs) {
      for (const [re, what] of DARK_MARKERS) {
        if (re.test(src)) problems.push(`${relative(FRONTEND, f)}: ${what}`);
      }
    }
    assert.deepEqual(problems, [], `${route} (${relative(FRONTEND, file)}):\n  - ${problems.join("\n  - ")}`);
  });
}

// React #418 (Teams & Games UI, Nov 3): one exported 404.html serves every unknown URL, so useGameRoute()
// must not hide the old chrome by path prefix (static HTML and client render would differ on /team/ZZZ/).
// Light-header pages hide the old bars in CSS instead.
test("useGameRoute has no path-prefix hide; light pages hide old chrome in CSS (#418)", () => {
  assert.ok(!/startsWith\(/.test(gameRouteBody), "useGameRoute() must not use a path-prefix check");
  const globals = readFileSync(join(APP, "globals.css"), "utf8");
  assert.match(globals, /body:has\(\.sg-app\) \.fd-top,\s*body:has\(\.sg-app\) \.app-nav\s*\{\s*display:\s*none/);
});

test("brand link keeps the spaces in 'Fourth & Daily'", () => {
  const sg = readFileSync(join(FRONTEND, "components", "SimpleGame.tsx"), "utf8");
  assert.match(sg, /className="sg-brand">Fourth\{" "\}<span>&amp;<\/span>\{" "\}Daily</);
  assert.match(readFileSync(join(APP, "simple-game.css"), "utf8"), /\.sg-brand\{[^}]*column-gap:/);
});

// /games and /games/[gameId] share the iOS restyle and the <Trademark /> footer.
// Old chrome is hidden via .sg-app (not a /games/ prefix in useGameRoute; #418).
test("trademark footer (.sg-tm-note) is on /games and /games/[gameId]", () => {
  const tm = readFileSync(join(FRONTEND, "components", "SimpleGame.tsx"), "utf8");
  assert.match(tm, /export const Trademark = \(\) => <p className="sg-tm-note">/);
  for (const route of ["/games", "/games/[gameId]"]) {
    const file = ROUTES.find((r) => r.route === route)?.file;
    assert.ok(file, `${route} page missing`);
    assert.match(readFileSync(file, "utf8"), /<Trademark\b/, `${route} is missing the <Trademark /> footer`);
  }
  const css = readFileSync(join(APP, "games", "games-ios.css"), "utf8");
  assert.match(css, /\.ios-games \.sg-tm-note\s*\{[^}]*color:\s*var\(--ios-label-tertiary\)/, "game page footer uses iOS label color in light and dark");
});

