# NFL Analytics: handoff hub

**Single checklist for current state.** Last updated: 2026-10-26 (main at PR #29). History lives in [CHANGELOG.md](CHANGELOG.md); decisions live in [DECISIONS.md](DECISIONS.md).

| Link | What it is |
| --- | --- |
| [GitHub repo](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) | Source + docs |
| [Project site (Pages)](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/) | Landing page (served from `main` `/docs`) |
| [Fan demo](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/) | Fixture-only Next.js static export (checkable v1) |
| [Fourth-down quiz](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/demo/quiz/) | Offline quiz MVP (PR #28) |
| [EP audit](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/reports/ep/AUDIT.md) | Stage A gate report |
| [PRODUCT_NEXT_STEPS_DECISIONS.md](PRODUCT_NEXT_STEPS_DECISIONS.md) | P1–P9 answers; current authorization (Phase P only) |
| [ROADMAP.md](ROADMAP.md) | Phases and gates |

Note: Pages serves a static `index.html` with `.nojekyll`, so `.md` files are **not** rendered on Pages. Link Markdown docs through GitHub blob URLs.

---

## Status at a glance

| Area | State | Where |
| --- | --- | --- |
| Scope | NFL only; no betting/odds | [AGENTS.md](../AGENTS.md) |
| Phase 1: contracts + docs | Done | PR #1 era |
| Phase 2: 2023 ingest + replay | Done | PR #1 |
| Phase 3: Stage A EP/EPA | Done (audited, gate PASS) | PR #3; Convention B overlay PR #7 (D015) |
| Phase 4: situation WP | Prototype on main (Path A, train/eval reports) | PR #8, `reports/wp/` |
| Phase 6: decision tools | Offline prototypes on main: 4th-down analyzer, historical decision lab, season-aware transitions, punt variance + clock, Situation Lab UI | PRs #9, #11–#16 |
| Live feeds | **Not wired.** Feed evaluation + Sportradar planning docs; offline pre-snap mapper; one keyless Simulation trial T (no persist, `live_feed=false`) | PRs #17–#25 |
| Fan UI / Pages | Fixture-only demo + quiz + landing page on Pages | PRs #10, #26, #28, #29 |
| Current authorization | **Phase P only** (demo polish / PR hygiene). Phases A, F, L need explicit approval | PR #27 |

---

## Locked stack

Python + FastAPI · DuckDB + Parquet · scikit-learn (XGBoost only if justified) · Next.js + TypeScript · nflverse PBP via `nflreadpy==0.1.5` · train 2019–2021 / validate 2022 / test 2023 · local, CPU-only, no paid services.

---

## Open PRs (2026-10-26)

| PR | What | Recommendation |
| --- | --- | --- |
| #4 | Oct-11 CURRENT_STATE_AUDIT_PACKET snapshot | Superseded; close |
| #6 | NEXT_STEPS_AFTER_CONVENTION_B | Superseded by D015 + later deltas; close |
| #30 | Game Explorer win-chance chart (fixtures) | In review |

---

## Reproduce / test

```bash
cd backend && python3 -m pip install -e ".[dev,phase2,models]" && python3 -m pytest -q
cd frontend && npm ci && npm test && npm run typecheck && npm run build:pages
```

Model training and report commands: `python -m nfl_sim.models --help` (writes to `reports/ep`, `reports/wp`, `reports/fourth_down`, `reports/decision_lab`). Trained `.joblib` and `reports/**/*.parquet` are gitignored.

CI: `.github/workflows/ci.yml` (backend pytest; frontend test, typecheck, build, static export) runs on PRs and `main`.

---

## Gated / not done

- Convention B production promote, EP `joblib` promote, WP isotonic persist, further decision-lab hardening: **No** until authorized (P6–P8).
- Longer Sportradar Simulation trial, any paid key, production live feed, persisting raw vendor data: **not authorized**.
- nflfastR bit-parity: deferred (D014).
- Betting / odds / sportsbook features: **out of scope**.
