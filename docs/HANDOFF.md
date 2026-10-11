# NFL Analytics — Phase 1 handoff hub

**Single checklist for progress and accuracy.** Last updated: 2026-10-11.

| Link | What it is |
| --- | --- |
| [GitHub repo](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) | Source + docs on `main` |
| [GitHub Pages](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/) | Published docs site (this hub) |
| [This file on GitHub](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/docs/HANDOFF.md) | Same checklist in the repo |

---

## Status at a glance

| Area | State | Check |
| --- | --- | --- |
| Scope | NFL only; no betting/odds MVP | [AGENTS.md](AGENTS.md) |
| Phase 1 gate | Local complete; **awaiting your approval** before Phase 2 | below |
| GitHub | Public repo + Pages homepage set | links above |
| Full code scaffold on GitHub | Frontend contracts + docs on `main`; **backend package not yet on GitHub** (architect re-export pending) | [repo](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) |
| Models trained | **Not started** (research only) | do not treat as validated |

---

## Locked stack (verify against repo)

- Backend: Python + FastAPI  
- Storage: DuckDB + Parquet  
- Models: scikit-learn first; XGBoost only if justified  
- Frontend: Next.js + TypeScript  
- Data: nflverse PBP via **nflreadpy==0.1.5**  
- Experiment: train **2019–2021**, validate **2022**, test **2023**  
- Local CPU-only; no paid services required for historical MVP  

Source of truth: [AGENTS.md](AGENTS.md)

---

## Accuracy checklist — research & data

Open each doc and confirm claims match evidence (no fabricated benchmarks):

1. [RESEARCH_REGISTER.md](RESEARCH_REGISTER.md) — six families (EP, EPA, WP, fourth-down design, empirical sampling, calibration); licenses; reproduced vs approximated vs unreproducible  
2. [MODEL_CATALOG.md](MODEL_CATALOG.md) — Stage A order: EP → EPA → situation WP → empirical stubs; fourth-down Phase 6  
3. [LICENSING_AND_DATA_SOURCES.md](LICENSING_AND_DATA_SOURCES.md) — nflverse / nflreadpy terms  
4. [DATA_EXPERIMENT.md](DATA_EXPERIMENT.md) — 2019–2023 coverage; column→canonical map; `ep`/`epa`/`wp` = **reference**, not observed state  
5. [MODEL_VALIDATION.md](MODEL_VALIDATION.md) — fair baseline; Brier / log loss / calibration / *n* under `/reports/`; no leakage; no arbitrary “beat baseline by X”  

**Verified in research/data workstreams (re-check if you doubt):**

- `nflreadpy==0.1.5` installs; loads 2019–2023 PBP with reference `ep`/`epa`/`wp`  
- REG scrimmage EP/WP inputs essentially complete; split sizes ~116k / 40k / 40k plays  
- Free PBP is **batch historical**, not live  

---

## Accuracy checklist — architecture & contracts

1. [REPO_AUDIT.md](REPO_AUDIT.md) — empty/greenfield baseline  
2. [ARCHITECTURE.md](ARCHITECTURE.md) — component boundaries; live adapter deferred  
3. [DECISIONS.md](DECISIONS.md) — ADR-style stack and schema choices  
4. [DATA_DICTIONARY.md](DATA_DICTIONARY.md) — MVP fields, units, missingness; pre-play vs post-play  
5. [ROADMAP.md](ROADMAP.md) — phase gates; Phase 2 recommendation  

**Contract tests reported by lead (re-run locally to confirm):**

- Backend pytest: **6 passed**  
- Frontend typecheck + contract tests: **2 passed**  

```bash
cd backend && pip install -e ".[dev]" && pytest -q
cd frontend && npm install && npm run typecheck && npm test
```

---

## Accuracy checklist — UI direction (docs only)

1. [UI_DESIGN_SYSTEM.md](UI_DESIGN_SYSTEM.md) — minimalist/elegant tokens; truth chips (historical / predicted / simulated)  
2. [UI_COMPONENT_RULES.md](UI_COMPONENT_RULES.md) — tables vs charts; no overclaiming recommendations  
3. [UI_SCREEN_SPECS.md](UI_SCREEN_SPECS.md) — eight screens; composition rules  

No Next.js product screens implemented yet — specs only.

---

## What is explicitly NOT done

- Historical ingest product pipeline (access verified only)  
- Trained/calibrated EP, EPA, or WP models  
- Live data providers  
- Full UI implementation  
- Phase 2+ (blocked on your approval)  

---

## Decisions still needed from you

1. Approve Phase 1 contracts (or list required changes)  
2. Confirm repo name/visibility (current: public `nfl-analytics-simulator`)  
3. Phase 2 import: **2023 smoke first** (recommended) vs full 2019–2023 immediately  
4. Rotate the chat-pasted GitHub PAT; use environment secret `GH_TOKEN` for future pushes  

---

## Recommended Phase 2 (only after approval)

nflreadpy pin → Parquet/DuckDB canonical projection → FastAPI games/plays/situation → Next.js historical-labeled shell (apply UI specs) → provider stub. Model training per catalog is a later phase unless you expand scope.
