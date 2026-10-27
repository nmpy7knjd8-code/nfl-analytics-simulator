// Slim copy of lib/quizPack.json with only what the Daily screens need, so the
// browser downloads ~1/4 of the bytes. Regenerate: node scripts/build-daily-pack.mjs
// (lib/daily.test.ts fails if it drifts from quizPack.json).
import { readFileSync, writeFileSync } from "node:fs";

export function slim(pack) {
  const S = ["posteam", "defteam", "home_team", "away_team", "posteam_score", "defteam_score", "qtr",
    "quarter_seconds_remaining", "yardline_100", "down", "distance"];
  return {
    schema_version: "fourth_and_daily_pack.v1",
    derived_from: pack.schema_version,
    source: pack.source,
    items: pack.items.map((it) => ({
      id: it.id,
      kind: it.kind,
      source: { season: it.source.season, week: it.source.week, game_date: it.source.game_date, game_id: it.source.game_id },
      situation: Object.fromEntries(S.map((k) => [k, it.situation[k]])),
      historical_action: it.historical_action,
      // 4 decimals (0.01 win-chance points) is far finer than anything shown or scored.
      reveal: {
        recommendation: it.reveal.recommendation,
        values: Object.fromEntries(Object.entries(it.reveal.values).map(([k, v]) => [k, Number(v.toPrecision(6))])),
      },
    })),
  };
}

if (process.argv[1]?.endsWith("build-daily-pack.mjs")) {
  const dir = new URL("../lib/", import.meta.url).pathname;
  const pack = JSON.parse(readFileSync(dir + "quizPack.json", "utf8"));
  writeFileSync(dir + "dailyPack.json", JSON.stringify(slim(pack)) + "\n");
  console.log(`dailyPack.json: ${pack.items.length} items`);
}
