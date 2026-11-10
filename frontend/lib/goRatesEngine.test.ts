import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  goRates, parseGoRates, engineCellAt, engineLayer, cellAt, pct,
  MODEL_GO_LABEL, TEAMS_WENT_LABEL, type GoRatesFile,
} from "./goRates";
import { CHECKER_ENABLED } from "./features";
import { iosChart, iosColor } from "./tokens";

const site = JSON.parse(readFileSync(new URL("./site/gorates.json", import.meta.url), "utf8"));
const stubRaw = JSON.parse(
  readFileSync(new URL("./fixtures/gorates.engine-stub.json", import.meta.url), "utf8"),
);
const stub = parseGoRates(stubRaw);
const { engine: _e, engineCells: _c, ...siteWithoutEngine } = site as Record<string, unknown>;
const noEngine = parseGoRates(siteWithoutEngine);

const BANNED = /epa|wpa|xpass|odds|spread|vegas|bet|cover|moneyline|over\/under/i;

test("D6: a file with no engine block renders nothing, even if the flag is on", () => {
  assert.equal(noEngine.engine, undefined);
  assert.equal(noEngine.engineCells, undefined);
  assert.equal(engineCellAt(noEngine, 1, 45), null);
  assert.equal(engineLayer(noEngine, 0, 4, true), null);
  assert.deepEqual(cellAt(noEngine, 1, 45)!.cell, goRates.cells[0][4]);
});

test("D6: parser accepts the stub and the built file, and does not require engine.example", () => {
  assert.ok(stub.engine && stub.engineCells);
  assert.equal(stub.engine.version, "fourth_down_engine.v3");
  assert.equal(stub.schema, "gorates/v1");
  assert.deepEqual(stub.engine.fields, ["rated", "engineGo", "engineKick", "enginePunt", "closeCalls", "wentWhenEngineGo"]);
  const cell = engineCellAt(stub, 1, 5)!;
  assert.deepEqual(cell, stub.engineCells![0][0]);
  const [rated, go, kick, punt] = cell;
  assert.equal(go + kick + punt, rated);

  const built = parseGoRates(site);
  assert.ok(built.engine && built.engineCells);
  assert.equal(built.engine.example, undefined);
  assert.equal("example" in (site.engine ?? {}), false);

  const broken = parseGoRates({ ...stubRaw, engine: { version: "nope" }, engineCells: stubRaw.engineCells });
  assert.equal(broken.engine, undefined);
  assert.equal(broken.engineCells, undefined);
  assert.deepEqual(broken.cells[0][0], stub.cells[0][0]);
});

test("D6: 4th & 1 at the opponent's 41-50 matches the built engine cell", () => {
  assert.deepEqual(engineCellAt(goRates, 1, 45), [356, 353, 1, 2, 157, 319]);
  assert.deepEqual(engineCellAt(goRates, 1, 41), [356, 353, 1, 2, 157, 319]);
  assert.deepEqual(engineCellAt(goRates, 1, 50), [356, 353, 1, 2, 157, 319]);
});

test("D6: flag is committed off, and off hides the layer even when engine data is present", () => {
  assert.equal(CHECKER_ENABLED, false);
  assert.ok(goRates.engine && goRates.engineCells);
  assert.equal(engineLayer(goRates, 0, 4), null);
  assert.equal(engineLayer(stub, 0, 0), null);
  assert.equal(engineLayer(goRates, 0, 4, false), null);
});

test("D6: wording compares model go rate with how often teams went, with no banned words", () => {
  const v = engineLayer(stub, 0, 0, true)!;
  // stub: 4th-and-1, opp 1-10: engineGo 377 / 510, went 442 / 510
  assert.equal(v.modelGoPct, pct(377, 510));
  assert.equal(v.teamsWentPct, pct(442, 510));
  assert.equal(v.modelLabel, MODEL_GO_LABEL);
  assert.equal(v.teamsLabel, TEAMS_WENT_LABEL);
  assert.equal(v.summary, "Our model says go on 74% of these; teams went for it 87%.");
  assert.equal(v.agreeLine, "When our model said go, teams went 100%.");
  for (const s of [v.summary, v.agreeLine, v.modelLabel, v.teamsLabel]) {
    assert.doesNotMatch(s, BANNED);
  }
  const real = engineLayer(goRates, 0, 4, true)!;
  // 4th-and-1, opp 41-50: engineGo 353 / 356, went 322 / 356
  assert.equal(real.modelGoPct, pct(353, 356));
  assert.equal(real.teamsWentPct, pct(322, 356));
  assert.doesNotMatch(real.summary + (real.agreeLine ?? ""), BANNED);
});

test("D6: HeatMap is unchanged when the engine block is absent", async () => {
  const { createElement, default: React } = await import("react");
  (globalThis as unknown as { React: typeof React }).React = React;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { HeatMap } = await import("../components/HeatMap");
  const html = renderToStaticMarkup(createElement(HeatMap, { file: noEngine, enabled: true }));
  assert.match(html, /Where coaches go for it/);
  assert.match(html, /Went for it/);
  assert.doesNotMatch(html, /hm-engine|Our model says go|Teams went for it/);
});

test("D6: HeatMap renders nothing for the engine layer when the flag is off", async () => {
  const { createElement, default: React } = await import("react");
  (globalThis as unknown as { React: typeof React }).React = React;
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { HeatMap, EngineLayer } = await import("../components/HeatMap");
  assert.equal(CHECKER_ENABLED, false);
  const page = renderToStaticMarkup(createElement(HeatMap));
  assert.match(page, /Where coaches go for it/);
  assert.doesNotMatch(page, /hm-engine|Our model says go|Teams went for it/);
  assert.equal(renderToStaticMarkup(createElement(EngineLayer, { file: goRates, row: 0, col: 4 })), "");
  assert.equal(renderToStaticMarkup(createElement(EngineLayer, { file: stub, row: 0, col: 0 })), "");
  const on = renderToStaticMarkup(createElement(HeatMap, { file: stub, enabled: true }));
  assert.match(on, /hm-engine/);
  assert.match(on, /Our model says go/);
  assert.match(on, /Teams went for it/);
  assert.match(on, /Our model says go on 74% of these; teams went for it 87%\./);
  assert.doesNotMatch(on, BANNED);
});

test("D6: engine layer series are accent blue and gray only", async () => {
  const { engineLayerSeries } = await import("../components/HeatMap");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const rules = css.split("}").filter((r) => r.includes(".hm-engine")).join("}");
  assert.equal(engineLayerSeries.model, iosChart.light.series[0]);
  assert.equal(engineLayerSeries.teams, iosColor.light.labelSecondary);
  assert.match(rules, /--ios-accent/);
  assert.match(rules, /--ios-label-secondary/);
  assert.doesNotMatch(rules, /--ios-chart-series-[2-4]|--ios-warning|--ios-success|--ios-danger|#ff9f0a|#ffd60a|#34c759|#30d158|#af52de|#bf5af2|#ff3b30|#ff453a/i);
  assert.doesNotMatch(rules, /team-color|--team-/i);
  assert.match(rules, /prefers-reduced-motion:\s*reduce/);
});
