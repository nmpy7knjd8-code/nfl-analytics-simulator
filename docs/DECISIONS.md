# Architecture Decisions

## D001 — Discard incomplete TypeScript monorepo for locked stack

* **Status:** Accepted (2026-10-11)
* **Context:** Greenfield workspace; partial pnpm/TS scaffold started before stack lock.
* **Decision:** Remove it. Adopt AGENTS.md: Python/FastAPI, DuckDB/Parquet, sklearn, Next.js/TS.
* **Consequences:** Phase 1 = schemas/docs only; engine packages stubbed.

## D002 — Python client: nflreadpy==0.1.5

* **Status:** Accepted (data workstream verified)
* **Context:** `nfl_data_py` deprecated; nflreadpy maintained. PyPI 0.1.5 verified; main 0.1.7 unpublished.
* **Decision:** Pin **`nflreadpy==0.1.5`**. `cache_dir` must be `pathlib.Path` (str breaks mkdir in 0.1.5).
* **Fallback:** Direct Parquet URLs from nflverse-data releases (same files).

## D003 — Contracts are schema-only in Phase 1

* **Status:** Accepted
* **Decision:** Shared typed contracts + minimal validation tests. No ingest/models/UI implementation in Phase 1.
* **Consequences:** Phase 2+ builds against these interfaces after user approval.

## D004 — Season experiment split unchanged

* **Status:** Accepted (data workstream: source sufficient)
* **Decision:** Train 2019–2021, validate 2022, test 2023. REG scrimmage for fit; POST for reconstruction.
* **Evidence:** DATA_EXPERIMENT.md — ~0% null on EP/WP pre-play inputs; sha256s recorded.

## D005 — snake_case JSON across API boundary

* **Status:** Accepted
* **Decision:** Pydantic + TS mirrors use snake_case (FastAPI default).

## D006 — Truth labels on derived outputs

* **Status:** Accepted
* **Decision:** `Provenance.truth_label` ∈ {historical, predicted, counterfactual}. Sims default counterfactual.

## D007 — Live providers non-blocking

* **Status:** Accepted
* **Decision:** Adapter stubs only; historical path has zero live dependency; no paid MVP credentials.

## D008 — Reference model columns namespaced

* **Status:** Accepted (research + data)
* **Decision:** nflverse `ep` / `epa` / `wp` / `vegas_wp` / etc. live under `CanonicalPlay.reference` or `reference_ep`/`reference_wp` on situations. They are **not** observed state and must not silently enter feature matrices.
* **Consequences:** Our model outputs use `ModelPrediction` with truth_label `predicted`.

## D009 — Derived receive_2h_ko + is_home_possession

* **Status:** Accepted
* **Decision:** Store as canonical derived fields. `receive_2h_ko` absent from Parquet; derive per nflfastR helper logic (DATA_EXPERIMENT §3.2).
* **Consequences:** Required for nflfastR-compatible WP features.

## D010 — Baseline model order

* **Status:** Accepted (MODEL_CATALOG)
* **Order:** (1) EP sklearn multinomial → (2) EPA from EP → (3) situation WP without odds → (4) empirical sampling stubs parallel → (5) fourth-down **Phase 6**.
* **WP validation:** No arbitrary “beat baseline by X” gate; report Brier/log loss/calibration/n under `/reports/`; forbid leakage passes (`MODEL_VALIDATION.md`).

## D011 — Exclude FTN / participation from MVP

* **Status:** Accepted
* **Decision:** Do not ingest FTN/participation (CC BY-SA attribution + out of MVP scope).

## D012 — Team IDs = abbreviations

* **Status:** Accepted (MVP)
* **Decision:** `home_team_id` / `away_team_id` / `possession_team_id` use nflverse team abbreviations.

## D013 — Pin mutable nflverse release assets

* **Status:** Accepted
* **Decision:** Tag `pbp` mutates; Phase 2 manifests must store sha256 + timestamp.json (values in DATA_EXPERIMENT).

## Open decisions (user)

1. GitHub visibility (public/private) and exact repo name once auth available — see `PUSH_WHEN_AUTH.md`.
2. Phase 2 import: 2023 smoke-first vs all five seasons immediately (architect recommends smoke then backfill).
3. Confirm Stage A EP = sklearn multinomial (catalog) vs “reference columns only” for first UI replay (can do both: columns for replay, sklearn for Phase 3).
