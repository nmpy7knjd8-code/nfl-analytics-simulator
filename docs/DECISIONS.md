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

## D014 — EP/EPA Stage A audit gate (2026-10-11)

* **Status:** Accepted
* **Decision:**
  * Merge audited Stage A as one unit ([PR #3](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3)); do not merge PR #2 as-is.
  * Keep project EPA convention; do **not** chase nflfastR bit-parity for this milestone.
  * Exclude optional `era_post_2020` from production model; preserve ablation in reports.
  * Focused public-model reconciliation is sufficient when internal identities pass and remaining diffs are explained.
  * Sequence after merge: WP → historical decision lab (4th down) → live adapters last.
  * Do not use 2023 holdout to tune conventions or features.
* **Evidence:** `reports/ep/AUDIT.md`, `reconciliation_2022.json`.

## Open decisions (user)

1. Approve starting Phase 4 situation WP after PR #3 merges (project stop-gate).
