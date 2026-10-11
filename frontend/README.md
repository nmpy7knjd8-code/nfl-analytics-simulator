# Frontend — NFL Analytics Simulator

Phase 2 ships a minimal Next.js **Game Explorer**: list 2023 historical games and replay ordered play-by-play. Truth chips mark data as **Historical**. Imported `ep`/`epa`/`wp` are labeled as nflverse/nflfastR reference columns — not models trained here.

No decision-lab / 4th-down / clock-management UI in this phase (see roadmap Phase 6).

## Commands

```bash
# API must be running with 2023 lake ingested
cd ../backend && python -m nfl_sim.api

cd ../frontend
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test             # contract tests
npm run build
```

Env: `NFL_SIM_API_ORIGIN` (default `http://127.0.0.1:8000`).
