# Architecture — NFL Analytics Simulator

**Phase:** 1 (design + contracts)  
**Scope:** NFL only. No college. No betting/odds product features in MVP.

## Goals

Historical reconstruction → validated baselines → reproducible simulation → optional live context later. Label **historical / predicted / counterfactual** separately.

## System context

```
nflverse PBP (batch Parquet)
        │
        ▼
┌───────────────────┐     ┌────────────────────┐
│ Ingest (Phase 2)  │────▶│ Canonical store    │
│ nflreadpy==0.1.5  │     │ DuckDB + Parquet   │
└───────────────────┘     └─────────┬──────────┘
                                    │
┌───────────────────┐     ┌─────────▼──────────┐
│ Live adapter      │     │ FastAPI (Phase 2+) │
│ (non-blocking)    ┼──X──▶│ typed contracts    │
└───────────────────┘     └─────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
     Models (Phase 3+)      Sim engine (Phase 4+)   Next.js UI (Phase 2+)
     EP→EPA→WP (sklearn)    seeded Monte Carlo      truth labels required
```

## Components

| Component | Path | Phase | Responsibility |
| --- | --- | --- | --- |
| Contracts | `backend/.../contracts`, `frontend/contracts` | **1** | Typed schemas; no outcome logic |
| Ingest | `backend/.../ingest` | 2 | nflreadpy load; pin sha256; Parquet lake |
| Store | `backend/.../store` | 2 | DuckDB over canonical Parquet |
| API | `backend/.../api` | 2 | FastAPI JSON (snake_case) |
| Models | `backend/.../models` | 3+ | Stage A order below |
| Simulation | `backend/.../sim` | 4+ | Seeded MC + provenance |
| Providers | `backend/.../providers` | later | Live boundary; demo/unconfigured OK |
| Frontend | `frontend/` | 2+ | Next.js against contracts |

## Baseline model order (locked)

1. **EP** — sklearn multinomial logistic (7 next-score classes); published `ep` = reference only  
2. **EPA** — from pre/post EP (+ documented special cases); published `epa` = reference  
3. **Situation WP** — sklearn logistic/HGB; **no odds/spread/`vegas_wp` inputs**; see MODEL_VALIDATION.md  
4. **Empirical sampling stubs** — situation-matched resample for early sim  
5. **Fourth-down** — Phase 6 design (nfl4th-inspired)

## Canonical representations

See DATA_DICTIONARY.md and Pydantic models:

* `GameSummary` — metadata including `roof`, `home_opening_kickoff`
* `GameSituation` — pre-play freeze (EP/WP feature inputs + derived `receive_2h_ko`)
* `CanonicalPlay` — observed post-play + `reference` namespace for nflfastR columns
* `ModelPrediction` / `SimulationRequest|Result` / `Provenance`

## Ingestion (Phase 2 design)

1. Pin `nflreadpy==0.1.5`; `update_config(cache_dir=Path(...))`.
2. Download 2019–2023 Parquet; write manifest (URL, sha256, timestamp).
3. Project §3 fields; derive `receive_2h_ko`, `is_home_possession`.
4. Namespace reference columns; never overwrite history with sims.
5. Split flags from season; train filter = REG + valid down.

## Validation

Chronological holdouts. Probabilistic metrics: Brier, log loss, calibration, sample sizes under `/reports/`. No arbitrary WP “beat baseline by X” before baseline/data understood. No leakage-based passes.

## Live boundary

Historical MVP needs zero paid credentials. Providers may be `demo` / `unconfigured`.

## Risks

| Risk | Mitigation |
| --- | --- |
| Mutable nflverse releases | sha256 pin |
| Treating reference ep/wp as labels/features | namespaced `reference` |
| Scope creep in Phase 1 | phase gate |
| FTN licensing | excluded from MVP |

## Compute

Local CPU-only.
