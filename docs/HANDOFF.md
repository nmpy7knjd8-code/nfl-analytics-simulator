# NFL Analytics — handoff hub

**Single checklist for progress and accuracy.** Last updated: 2026-10-11 (EP/EPA audit gate **PASS** — Stage A merge-ready).

| Link | What it is |
| --- | --- |
| [GitHub repo](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) | Source + docs |
| [GitHub Pages hub](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/) | Published docs site |
| [Phase 2 review (Pages)](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/PHASE2_REVIEW) | Public accuracy check page |
| [HANDOFF (Pages)](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/HANDOFF) | This checklist on Pages |
| [EP audit (repo)](../reports/ep/AUDIT.md) | Gate report — merge readiness |
| [EP_MODEL_SPEC.md](EP_MODEL_SPEC.md) | Stage A target / EPA semantics |
| [DATA_PIN_NOTES.md](DATA_PIN_NOTES.md) | Lake pins + digest drift |

---

## Status at a glance

| Area | State | Check |
| --- | --- | --- |
| Scope | NFL only; no betting/odds MVP | [AGENTS.md](AGENTS.md) |
| Phase 1 | Contracts + docs complete | below |
| Phase 2 | **Complete** — 2023 historical ingest + ordered play replay on `main` | PR #1 merged |
| Phase 3 Stage A | **Audit gate PASS — merge-ready** via PR #3 (do not merge PR #2 as-is) | [`reports/ep/AUDIT.md`](../reports/ep/AUDIT.md) |
| Decision lab (4th / clock / strategy) | Planned **after WP** | [ROADMAP.md](ROADMAP.md) |
| Models trained | Sklearn multinomial EP (**no era feature**) + deterministic EPA | not nflfastR parity |
| Next milestone | Merge audited Stage A → Phase 4 situation WP | [ROADMAP.md](ROADMAP.md) |

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

## Merge status (actual)

| PR | Branch | Role | Action |
| --- | --- | --- | --- |
| [#2](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/2) | `cursor/stage-a-ep-epa-0cca` | Stage A without audit fixes | **Do not merge as-is** — close when #3 lands |
| [#3](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/3) | `cursor/ep-epa-audit-d4ea` | **Stacked on #2** + audit + gate decisions | **Merge unit** → `main` |

PR #3 is not independent of #2; it contains Stage A commits plus audit/gate work. Merge #3 only.

---

## What works (Phase 3 Stage A — audited)

1. `docs/EP_MODEL_SPEC.md` defines next-score-in-half target, eligibility, leakage bans, EPA possession semantics.
2. Lake backfill **2019–2022** + preserved 2023 pin (`b8417df9…`); see `DATA_PIN_NOTES.md`.
3. Sklearn multinomial EP **without** `era_post_2020`; `C` on **2022 only**; 2023 held out.
4. Deterministic `model_epa` with timeout / terminal / same-possession / possession-change (half-boundary fix).
5. XP/2PT excluded from next-score labels; API hardened (no caller `model_path`).
6. Accounting identities pass on synthetic + train-season contiguous next-scrimmage chains.
7. Focused nflverse reconciliation: post-score possession-change MAE is **convention**, not silent “fix.”
8. Reports: `reports/ep/AUDIT.md`, `EVALUATION.md`, `reconciliation_2022.json`, `DISCREPANCY_BACKLOG.md`.

### Headline metrics (held-out test 2023 — report only; not tuned)

| Metric | Model | Constant baseline |
| --- | ---: | ---: |
| log_loss | 1.314 | 1.539 |
| Brier multiclass | 0.677 | 0.761 |
| MAE vs reference `ep` | 0.368 | agreement only |
| MAE vs reference `epa` | 0.669 | agreement only |

Val 2022 model log_loss **1.336** (era excluded). Ablation with-era 1.337 preserved in `baselines_2022.json`.

### Reproduce Stage A

```bash
cd backend
python3 -m pip install -e ".[dev,phase2,models]"
python3 -m nfl_sim.ingest --seasons 2019,2020,2021,2022   # if lake empty; 2023 pin preserved
python3 -m nfl_sim.models train --out ../reports/ep --include-test
python3 -m nfl_sim.models reconcile --out ../reports/ep/reconciliation_2022.json
pytest -q
```

### Tests last run (gate agent)

| Suite | Result |
| --- | --- |
| Backend `pytest` | **54 passed** |
| Frontend `npm test` | **2 passed** |
| Frontend `npm run typecheck` | **pass** |
| Accounting identity (train sample) | **pass** (`reconciliation_2022.json`) |

---

## What works (Phase 2)

1. `python -m nfl_sim.ingest --season 2023` → immutable raw + manifest + canonical + DuckDB.
2. FastAPI games/plays; reference ep/epa/wp namespaced.
3. Next.js Game Explorer with **Historical** truth chips.
4. Known game: `2023_01_DET_KC`.

---

## Limitations / open gaps

- EP/EPA **approximated**; largest reference gap = **EPA after scoring plays** (val MAE≈6.47 on that slice vs ≈0.34 same-possession). Explained convention — see `AUDIT.md` §4.
- UI still shows imported reference columns for replay (model score API optional).
- Situation WP not trained.
- No live providers; no Strategy / decision lab.
- CI workflow proposed at `reports/ep/ci-workflow-proposed.yml` (needs `workflow` token scope to install).

---

## What is explicitly NOT done

- nflfastR / fastrmodels bit-parity  
- Situation WP  
- Live data providers  
- Full Strategy Lab / 4th-down / clock **recommendations**  
- Complex ML / new data providers  

---

## Explicit gate for beginning WP

After audited Stage A is on `main`:

1. Internal EPA identities pass under project conventions (**yes** on current head).  
2. Remaining nflverse diffs explained (post-score convention) — exact parity **not** required.  
3. User phase approval before expanding scope.  
4. Sequence: **WP → historical decision lab (4th down) → live adapters last.**  
5. Do **not** use 2023 to tune conventions/features.

---

## Product goal — situational decisions (later)

Answer **what to do** in situations (clock, 4th-down, etc.) after EP/EPA/WP + sim. Until then, no fake recommendations. Live adapters stay separate from finalized historical records.
