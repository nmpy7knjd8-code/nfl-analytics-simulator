# NFL Analytics Simulator

Research-grounded **NFL-only** analytics and simulation: reconstruct real games, validate baselines (EP → EPA → situation WP), and run reproducible counterfactual simulations. Local-first, CPU-only. No sports-betting product features in the MVP.

**Project docs:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [AGENTS.md](AGENTS.md)

**Phase:** 1 complete locally — architecture + shared contracts. **Stopped for user approval** before Phase 2 (ingest/API/UI).

## Stack (locked)

| Layer | Choice |
| --- | --- |
| Backend | Python + FastAPI (API in Phase 2+) |
| Storage | DuckDB + Parquet |
| Models | scikit-learn first; XGBoost only if justified |
| Frontend | Next.js + TypeScript (screens in Phase 2+) |
| Data | nflverse PBP via **nflreadpy==0.1.5** |

## Repository layout

```
AGENTS.md                 Process + stack defaults
docs/                     Architecture, research, data experiment, validation
backend/                  Python package (contracts implemented; other pkgs stubbed)
frontend/contracts/       TypeScript contract mirrors
PUSH_WHEN_AUTH.md         Exact gh create/push/Pages steps
```

## Phase 1 commands

```bash
# Python contract tests
cd backend
python3 -m pip install -e ".[dev]"
pytest -q

# TypeScript contract typecheck / tests
cd ../frontend
npm install
npm run typecheck
npm test
```

## Experiment window

Train 2019–2021 · validate 2022 · test 2023 (REG scrimmage for fits). See `docs/DATA_EXPERIMENT.md`.

## GitHub / Pages

Repo creation requires auth — see [PUSH_WHEN_AUTH.md](PUSH_WHEN_AUTH.md). Until then, this README is the project home.
