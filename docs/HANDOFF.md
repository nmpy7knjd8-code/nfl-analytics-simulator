# NFL Analytics — handoff hub

**Single checklist for progress and accuracy.** Last updated: 2026-10-11 (Phase 3 Stage A EP/EPA complete locally — stop for approval).

| Link | What it is |
| --- | --- |
| [GitHub repo](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) | Source + docs |
| [GitHub Pages hub](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/) | Published docs site |
| [Phase 2 review (Pages)](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/PHASE2_REVIEW) | Public accuracy check page |
| [HANDOFF (Pages)](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/HANDOFF) | This checklist on Pages |
| [PHASE2_REVIEW.md](PHASE2_REVIEW.md) | Review pack in-repo |
| [EP_MODEL_SPEC.md](EP_MODEL_SPEC.md) | Stage A target / EPA semantics |
| [DATA_PIN_NOTES.md](DATA_PIN_NOTES.md) | Lake pins + digest drift |

---

## Status at a glance

| Area | State | Check |
| --- | --- | --- |
| Scope | NFL only; no betting/odds MVP | [AGENTS.md](AGENTS.md) |
| Phase 1 | Contracts + docs complete | below |
| Phase 2 | **Complete** — 2023 historical ingest + ordered play replay on `main` | PR #1 merged |
| Phase 3 Stage A | **Complete locally** — independent EP + EPA; held-out 2023 report | `/reports/ep/` |
| Decision lab (4th / clock / strategy) | Planned **Phase 6** | [ROADMAP.md](ROADMAP.md) |
| Models trained | Stage A sklearn multinomial EP + deterministic EPA (**approximated**) | not nflfastR parity |
| Next milestone | User approval → Phase 4 situation WP **or** public-model reconciliation pass | [ROADMAP.md](ROADMAP.md) |

---

## Locked stack

- Backend: Python + FastAPI  
- Storage: DuckDB + Parquet  
- Models: scikit-learn first (Phase 3+); XGBoost only if justified  
- Frontend: Next.js + TypeScript  
- Data: nflverse PBP via **nflreadpy==0.1.5**  
- Experiment: train **2019–2021**, validate **2022**, test **2023**  
- Local CPU-only; no paid services required for historical MVP  

---

## What works (Phase 3 Stage A)

1. `docs/EP_MODEL_SPEC.md` defines next-score-in-half target, eligibility, leakage bans, EPA possession semantics **before** training.
2. Lake backfill **2019–2022** + preserved 2023 pin (`b8417df9…`); see `DATA_PIN_NOTES.md` and `reports/data/backfill_validation.json`.
3. Sklearn multinomial EP; `C` chosen on **2022 only**; 2023 held out. CLI: `python -m nfl_sim.models train|eval|score`.
4. Deterministic `model_epa` with timeout / terminal / same-possession / possession-change cases (tested).
5. Reports: `reports/ep/EVALUATION.md`, `metrics.json`, `reference_agreement.json`, `DISCREPANCY_BACKLOG.md`.
6. Optional API: `POST /models/ep/score` (503 until artifact present; replay routes unchanged).

### Headline metrics (held-out test 2023)

| Metric | Model | Constant baseline |
| --- | ---: | ---: |
| log_loss | 1.316 | 1.539 |
| Brier multiclass | 0.678 | 0.761 |
| MAE vs reference `ep` | 0.367 | agreement only |
| MAE vs reference `epa` | 0.675 | agreement only |

### Reproduce Stage A

```bash
cd backend
python3 -m pip install -e ".[dev,phase2,models]"
python3 -m nfl_sim.ingest --seasons 2019,2020,2021,2022   # if lake empty; 2023 already pinned
python3 -m nfl_sim.models train --out ../reports/ep --include-test
pytest -q
```

---

## What works (Phase 2)

1. `python -m nfl_sim.ingest --season 2023` → immutable raw + manifest + canonical + DuckDB.
2. FastAPI games/plays; reference ep/epa/wp namespaced.
3. Next.js Game Explorer with **Historical** truth chips.
4. Known game: `2023_01_DET_KC`.

### Reproduce Phase 2

```bash
cd backend
python3 -m pip install -e ".[dev,phase2]"
python -m nfl_sim.ingest --season 2023
pytest -q
python -m nfl_sim.api

cd ../frontend
npm install && npm run typecheck && npm test
npm run dev
```

### Tests last run (Phase 3 agent)

| Suite | Result |
| --- | --- |
| Backend `pytest` | **33 passed** (Phase 2 + split gate + EP/EPA) |
| Frontend `npm test` | **2 passed** |
| Frontend `npm run typecheck` | **pass** |

---

## Limitations / open gaps

- EP/EPA **approximated**; largest reference gap = **EPA on possession changes** (MAE≈2.76 on test vs ≈0.34 same-possession). See `reports/ep/DISCREPANCY_BACKLOG.md`.
- UI still shows imported reference columns for replay (model score API optional).
- Situation WP not trained.
- No live providers; no Strategy / decision lab (Phase 6).
- fastrmodels XGB EP not executed (Python sklearn Stage A).

---

## What is explicitly NOT done

- nflfastR / fastrmodels bit-parity  
- Situation WP  
- Live data providers  
- Full Strategy Lab / 4th-down / clock **recommendations** (Phase 6)  
- Phase 4+  

---

## Decisions still needed from you

1. Approve Phase 3 Stage A before Phase 4 (WP)  
2. Whether to run a **public-model reconciliation pass** before WP (recommended if EPA will feed decisions soon)  

---

## Product goal — situational decisions (later)

Answer **what to do** in situations (clock, 4th-down, etc.) in **Phase 6** after EP/EPA/WP + sim. Until then, no fake recommendations.
