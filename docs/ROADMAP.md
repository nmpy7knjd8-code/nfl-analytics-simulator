# Roadmap

Phase gates: tests + report + **user approval** before next phase.

## Phase 1 — Audit, research, architecture, contracts ✓

* Repo audit, AGENTS.md, architecture/decisions/dictionary
* Research + data docs adopted; contracts + tests
* GitHub docs + Pages hub

## Phase 2 — Historical ingest + API + minimal replay UI ← **STOP HERE**

**Scope: historical replay only.** No model training. No situational decision support.

* `nflreadpy==0.1.5` import with Path `cache_dir`; pin sha256 + row count in season manifest
* **2023** smoke season → immutable raw Parquet + canonical games/plays Parquet + DuckDB
* FastAPI: list games, get game, ordered plays (pagination)
* Next.js Game Explorer: historical game list + PBP replay; truth chip **Historical**; reference ep/epa/wp labeled as imported nflverse columns
* Tests: projection/derive, API contracts, real 2023 ingest + known game replay
* **Not in Phase 2:** EP/EPA/WP training, live feeds, Strategy Lab, 4th-down / clock recommendations

## Phase 3 — Stage A EP → EPA

* sklearn multinomial EP; EPA transform; compare to reference columns
* Metrics under `/reports/`; chronological splits

## Phase 4 — Situation WP + empirical sampling stubs

* WP without odds; MODEL_VALIDATION reporting
* Empirical resample stubs for sim paths

## Phase 5 — Simulation engine + UI workflow

* Seeded MC; game → situation → baseline → distributions
* Freeze a historical (or later live) play and explore alternate paths

## Phase 6 — Strategy / decision lab (user priority)

Situational decision support on top of validated EP/EPA/WP and the rules engine — **not** Phase 2 work.

* Fourth-down: go vs punt vs field goal (nfl4th-inspired; disclose simplifications)
* Clock management: timeout use, spike/kneel, end-of-half / two-minute choices
* Compare options under EP vs win-probability objectives (they can disagree)
* Label outputs clearly: historical observation vs model prediction vs counterfactual simulation
* UI: Strategy Lab + Situation Lab decision panels per UI_SCREEN_SPECS
