# NFL Analytics Simulator

**Live site:** https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/ · **Fourth & Daily:** [/daily/](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/daily/) · **Games:** [/games/](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/games/) · **Check a 4th down:** [/fourth-down/](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/fourth-down/)

NFL-only analytics built on nflverse play-by-play: reconstruct real games, estimate expected points (EP/EPA) and win chance (WP), and explain fourth-down calls in plain English. There are no betting or odds features.

## What's on the site

- **Fourth-down quiz:** six fourth-down situations. For each one you pick Go, Field goal or Punt, and then see the model's win chance for each option and why. Some situations are real 2022 plays and some are example situations; the data is baked in at build time, with no live feed.
- **Game Explorer:** a few fixture games, play by play, with a win-chance chart and swing plays.
- **4th-down explainer:** sample situations with the model's recommendation and a short "Why".

The site uses fixture/example data and does not call the backend. Known data errors and fixes are tracked in issues and PRs.

## How the site is built

Every push to `main` builds and deploys the site with [`.github/workflows/pages.yml`](.github/workflows/pages.yml): `npm run build:pages` exports `frontend/` as a static site served at the root, and [`scripts/pages/assemble.py`](scripts/pages/assemble.py) adds static files from `docs/` (favicon, docs) and redirect pages for old links. `/demo/...` goes to the same page at the root, `/quiz/` to `/daily/`, and `/decide/` to `/fourth-down/`. `docs/index.html` (the old landing page) and the committed `docs/demo/` export are no longer shipped.

## Status

| Part | State |
| --- | --- |
| Data | nflverse play-by-play via `nflreadpy`, pinned per season by SHA-256 (2019–2023 ingest) |
| EP / EPA | scikit-learn multinomial EP model, audited ([report](reports/ep/AUDIT.md)); Convention B scoring EPA (D015) |
| Win probability | Situation WP prototype, trained 2019–2021, calibrated on 2022, reported on 2023 ([report](reports/wp/EVALUATION.md)) |
| Fourth down | Offline Go/FG/Punt analyzer and historical decision lab |
| Live data | None. Feed planning only ([docs/sportradar/](docs/sportradar/)) |

Trained model binaries and large generated data are not committed; rebuild them with `python -m nfl_sim.models`. More detail: [HANDOFF](docs/HANDOFF.md) · [ROADMAP](docs/ROADMAP.md) · [CHANGELOG](docs/CHANGELOG.md) · [DECISIONS](docs/DECISIONS.md) · [AGENTS](AGENTS.md).

## Run locally

```bash
# Backend: ingest, models, API
cd backend
python3 -m pip install -e ".[dev,phase2,models]"
python -m nfl_sim.ingest --season 2023
python -m pytest -q                 # unit tests; integration tests: -m integration
python -m nfl_sim.api               # http://127.0.0.1:8000

# Frontend
cd ../frontend
npm ci
npm test && npm run typecheck
npm run dev                         # http://localhost:3000
npm run build:pages && python3 ../scripts/pages/assemble.py   # same site as live, in _site/
```

CI ([`ci.yml`](.github/workflows/ci.yml)) runs backend pytest and frontend test, typecheck and build on every PR.

Data: nflverse play-by-play (CC BY 4.0).
