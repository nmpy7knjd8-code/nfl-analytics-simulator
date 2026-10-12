# Frontend — NFL Analytics Simulator

Fan-facing Next.js UI with a **phone-app** shell (bottom tabs, large taps, mobile-first column): branded home, **Games** replay, and **4th & short** explainer.

Truth chips mark **Historical** / **Predicted** / **Simulated**. When the FastAPI lake is not running, Games falls back to labeled **example** fixtures so `npm run dev` still works.

No betting / odds UI. Fourth-down numbers are fixtures until the offline scorer API is wired (`POST /models/fourth-down` hook left in the explainer).

## Commands

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run typecheck
npm test
npm run build
npm run build:pages  # static export → frontend/out (copy to docs/demo for GitHub Pages)
```

Optional live API: `NFL_SIM_API_ORIGIN` (default `http://127.0.0.1:8000`). Without it, example data is used automatically.

**GitHub Pages demo:** `NFL_SIM_STATIC_EXPORT=1` builds fixtures-only HTML under `docs/demo/` → [demo site](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/). No Sportradar / live feed.
