# Roadmap

Phase gates: tests + report + **user approval** before next phase.

## Phase 1 — Audit, research, architecture, contracts ✓

* Repo audit, AGENTS.md, architecture/decisions/dictionary
* Research + data docs adopted; contracts + tests
* GitHub docs + Pages hub

## Phase 2 — Historical ingest + API + minimal replay UI ✓

**Scope: historical replay only.** Merged to `main` (PR #1).

* `nflreadpy==0.1.5`; pinned 2023 raw + canonical lake + DuckDB
* FastAPI games/plays; Next.js Game Explorer; reference columns labeled

## Phase 3 — Stage A EP → EPA ← **STOP FOR APPROVAL**

* `EP_MODEL_SPEC.md` → leakage-safe sklearn multinomial EP → deterministic EPA
* Backfill 2019–2022; chrono split enforced; held-out 2023 report under `/reports/ep/`
* Reference agreement vs nflverse `ep`/`epa` + discrepancy backlog (possession-change EPA)

### Follow-on (optional, before or parallel to Phase 4)

**Public-model reconciliation pass** — compare/port open nflfastR/fastrmodels EP/EPA special cases (kickoff/touchback, scoring transitions, label stream diffs) on **validate 2022**; re-measure agreement; still never tune on 2023. Does not expand into WP or decision lab.

## Phase 4 — Situation WP + empirical sampling stubs

* WP without odds; MODEL_VALIDATION reporting
* Empirical resample stubs for sim paths

## Phase 5 — Simulation engine + UI workflow

* Seeded MC; game → situation → baseline → distributions
* Freeze a historical (or later live) play and explore alternate paths

## Phase 6 — Strategy / decision lab (user priority)

Situational decision support on top of validated EP/EPA/WP and the rules engine — **not** Phase 2/3 work.

* Fourth-down: go vs punt vs field goal (nfl4th-inspired; disclose simplifications)
* Clock management: timeout use, spike/kneel, end-of-half / two-minute choices
* Compare options under EP vs win-probability objectives (they can disagree)
* Label outputs clearly: historical observation vs model prediction vs counterfactual simulation
* UI: Strategy Lab + Situation Lab decision panels per UI_SCREEN_SPECS
