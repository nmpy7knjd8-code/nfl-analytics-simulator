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
  assert.match(read("../components/SimpleGame.tsx"), /<SiteMenuLinks \/>/);
  assert.match(read("../components/AppNav.tsx"), /<SiteMenuLinks \/>/);
  for (const href of ["/practice/", "/endless/", "/feed/", "/kicks/", "/games/", "/daily/stats/", "/about/"]) assert.ok(sg.includes(`<Link href="${href}">`), href);
});
