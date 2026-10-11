# NFL Analytics Simulator

Research-grounded **NFL-only** analytics and simulation: reconstruct real games, validate baselines (EP → EPA → situation WP), and later run reproducible counterfactual / decision-lab simulations. Local-first, CPU-only. No sports-betting product features in the MVP.

**Phase 2 (this branch):** 2023 historical ingest + FastAPI games/plays + Next.js Game Explorer replay. **Historical replay only** — no model training, no situational decision support (clock / 4th-down / strategy). Those belong in later roadmap phases (decision lab = Phase 6).

**Docs:** [docs/HANDOFF.md](docs/HANDOFF.md) · [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/ROADMAP.md](docs/ROADMAP.md) · [AGENTS.md](AGENTS.md)

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
