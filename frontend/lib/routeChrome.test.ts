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
const LEGACY_ROUTES = new Set(["/about", "/daily/stats", "/fourth-down", "/games", "/games/[gameId]"]);

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
    if (!gameRouteBody.includes(`"${route.replace(/\[[^\]]+\]/g, "")}`))
      problems.push(`not in AppNav useGameRoute(), so the old top bar and bottom nav still render on ${route}`);
    for (const [f, src] of srcs) {
      for (const [re, what] of DARK_MARKERS) {
        if (re.test(src)) problems.push(`${relative(FRONTEND, f)}: ${what}`);
      }
    }
    assert.deepEqual(problems, [], `${route} (${relative(FRONTEND, file)}):\n  - ${problems.join("\n  - ")}`);
  });
}
