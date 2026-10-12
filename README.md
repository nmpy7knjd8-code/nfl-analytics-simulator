# NFL Analytics Simulator

**Fan demo (example data, no live feed):** [https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/) · **Fourth-down quiz:** [demo/quiz/](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/quiz/)

Research-grounded **NFL-only** analytics and simulation: reconstruct real games, validate baselines (EP → EPA → situation WP), and later run reproducible counterfactual / decision-lab simulations. Local-first, CPU-only. No sports-betting product features in the MVP.

**Current main:** historical ingest + FastAPI games/plays + Next.js fan UI (branded home, Game Explorer, 4th-&-short explainer with example data when the API is offline). Model training lives in `backend/` / `reports/`; the UI speaks plain football language, not calibration metrics.

**Docs hub:** [GitHub Pages](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/) · [docs/HANDOFF.md](docs/HANDOFF.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [AGENTS.md](AGENTS.md)

## Stack

| Layer | Choice |
| --- | --- |
| Backend | Python + FastAPI |
| Storage | DuckDB + Parquet |
| Models | scikit-learn later (Phase 3+); not in Phase 2 |
| Frontend | Next.js + TypeScript |
| Data | nflverse PBP via **nflreadpy==0.1.5** (2023 smoke) |

## Reproduce Phase 2

```bash
# Backend + ingest 2023
cd backend
python3 -m pip install -e ".[dev,phase2]"
python -m nfl_sim.ingest --season 2023
pytest -q
python -m nfl_sim.api   # http://127.0.0.1:8000

# Frontend
cd ../frontend
npm install
npm run typecheck && npm test
npm run dev             # http://localhost:3000 → Game Explorer
```

Attribution: nflverse play-by-play (CC BY 4.0).
