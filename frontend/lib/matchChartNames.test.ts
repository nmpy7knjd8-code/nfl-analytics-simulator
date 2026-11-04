import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { teamNickname } from "./teams";

test("/match-chart shows team names, not raw codes, for every team in the chart files", () => {
  const dir = new URL("../../data/site/charts/", import.meta.url);
  const codes = new Set<string>();
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const j = JSON.parse(readFileSync(new URL(f, dir), "utf8"));
    for (const g of j.games) { codes.add(g.home); codes.add(g.away); }
  }
  assert.ok(codes.size >= 32);
  for (const c of codes) assert.notEqual(teamNickname(c), c, `no name for ${c}`);
  assert.match(readFileSync(new URL("../components/MatchChart.tsx", import.meta.url), "utf8"), /teamNickname\(g\.away\)/);
});
