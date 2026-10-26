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
* **Supersession (score-cash only):** D015 adopts Convention B for scoring-play EPA. D014’s “do not chase bit-parity” still applies to non-score slices and PAT row overlays; it no longer means “keep no-cash EPA in production.”

## D015 — EPA Convention B (score-cash) — ACCEPTED (2026-10-11)

* **Status:** Accepted (local review branch; not yet on `origin/main`)
* **Decision:** Production EPA uses Convention B: scoring plays with \(\|R\|>0\) → `EPA = R − ep_before`; non-score timeout/terminal/same-poss/PC unchanged; XP/2PT \(R=0\`.
* **Evidence:** Task A lake-`ep` diagnostics (2019–2022); `docs/EPA_CONVENTION_B_ATTRIBUTION.md`; `EP_MODEL_SPEC` §6; synthetics.
* **Artifact:** `ep_model.joblib` missing → project-model pre/post **Blocked** (`reports/ep/ARTIFACT_PROVENANCE.md`).
* **Brief:** `docs/DECISIONS_AND_FORWARD_PLAN.md` (successor to open-D015 PR #5 text).

## D016 — Situation WP: Path A prototype (2026-10-11)

* **Status:** Accepted (prototype on main via PR #8)
* **Decision:** Situation WP with no odds or market features; train 2019–2021, calibrate on 2022, report on 2023. Isotonic persistence is gated (P6–P8). nfeloml/nflfastR are for reference only.
* **Evidence:** `reports/wp/EVALUATION.md`, `metrics.json`, `calibration_*.csv`.

## D017 — Decision tools stay offline and labeled (2026-10-11)

* **Status:** Accepted (PRs #9, #11, #14)
* **Decision:** The fourth-down analyzer (go/FG/punt) and the historical decision lab run offline on a frozen lake. Outputs are labeled historical observation, model prediction, or counterfactual simulation. They are not presented as live recommendations.
* **Evidence:** `reports/fourth_down/`, `reports/decision_lab/`, `docs/HISTORICAL_DECISION_LAB.md`.

## D018 — Season-aware transitions + punt variance / outcome-dependent clock (2026-10-11)

* **Status:** Accepted on the decision-lab harness (PRs #12, #13)
* **Decision:** Convert/FG/punt empirics may be season-aware. Punt outcomes are variance-aware and the clock depends on the outcome. These are compared against the pooled baseline in reports, not silently swapped in.
* **Evidence:** `reports/season_aware_transitions/`, `reports/punt_clock_transitions/`.

## D019 — Feed choice and Sportradar trial T (2026-10-11 to 2026-10-12)

* **Status:** Accepted with limits (PRs #17–#25)
* **Decision:** Sportradar Simulation was evaluated as the candidate feed. The offline pre-snap mapper fails closed on a missing `receive_2h_ko`, and Path A is unsupported. One keyless trial T ran: 7 HTTP calls, no raw persistence, `live_feed=false`. The acceptance matrix was incomplete. No production live feed, paid keys, or raw vendor JSON persistence.
* **Evidence:** `docs/FEED_EVALUATION.md`, `docs/SPORTRADAR_TRIAL_T_REPORT.md`, `docs/OFFLINE_PRE_SNAP_MAPPER.md`.

## D020 — Product P1–P9 answers (2026-10-12)

* **Status:** Accepted (PR #27)
* **Decision:** Merge the Pages demo (#26). PR hygiene: #5 closed, #10 superseded. Accept the demo as checkable v1. Only Phase P is authorized; Phases A, F and L need explicit approval; live/paid/commercial work is a hard defer. Fan UI uses black and white with a sparse blue accent and a short plain-language "Why" on recommendations.
* **Evidence:** `docs/PRODUCT_NEXT_STEPS_DECISIONS.md`.

## D021 — GitHub Pages is a fixture-only static demo (2026-10-12)

* **Status:** Accepted (PRs #26, #28, #29)
* **Decision:** Pages serves `main` `/docs`: a static landing page (`index.html`, `.nojekyll`) and the Next.js static export under `docs/demo/` built from fixtures. No backend, live data or report files are served. Markdown docs are linked via GitHub blob URLs. Generated large data (`reports/**/*.parquet`) is gitignored and published as release assets.

## Open decisions (user)

_Items 1–3 below are historical (pre-PR #7/#8); current open gates are tracked in D020 / PRODUCT_NEXT_STEPS_DECISIONS.md._

1. Authorize push/merge of Convention B branch after review.
2. Restore original `ep_model.joblib` (or authorize explicit new-artifact rebuild) before model-surface acceptance.
3. Approve starting Phase 4 situation WP after A.2 model-surface gate.
