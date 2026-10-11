# Roadmap

Phase gates: tests + report + **user approval** before next phase.

## Phase 1 — Audit, research, architecture, contracts ← **STOP HERE**

* Repo audit, AGENTS.md, architecture/decisions/dictionary
* Research + data docs adopted; contracts + tests
* GitHub push when auth available (`PUSH_WHEN_AUTH.md`)
* **Await user approval of contracts before Phase 2**

## Phase 2 — Historical ingest + API + minimal UI shell (recommended)

* `nflreadpy==0.1.5` import with Path cache_dir; pin sha256s
* Prefer 2023 smoke then backfill 2019–2023
* DuckDB/Parquet canonical projection (§3 map)
* FastAPI: games, plays, situation-at-play
* Next.js shell labeling **historical** only
* Provider stub (`demo`/`unconfigured`)
* Tests: idempotent import, schema fixture, API smoke

## Phase 3 — Stage A EP → EPA

* sklearn multinomial EP; EPA transform; compare to reference columns
* Metrics under `/reports/`; chronological splits

## Phase 4 — Situation WP + empirical sampling stubs

* WP without odds; MODEL_VALIDATION reporting
* Empirical resample stubs for sim paths

## Phase 5 — Simulation engine + UI workflow

* Seeded MC; game → situation → baseline → distributions

## Phase 6 — Fourth-down decision evaluation

* nfl4th-inspired; disclose simplifications
