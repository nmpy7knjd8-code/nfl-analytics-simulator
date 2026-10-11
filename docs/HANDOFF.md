# NFL Analytics — handoff hub

**Single checklist for progress and accuracy.** Last updated: 2026-10-11 (Phase 2 complete locally).

| Link | What it is |
| --- | --- |
| [GitHub repo](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator) | Source + docs |
| [GitHub Pages](https://nmpy7knjd8-code.github.io/nfl-analytics-simulator/) | Published docs site (this hub) |
| [This file on GitHub](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/blob/main/docs/HANDOFF.md) | Same checklist in the repo |

---

## Status at a glance

| Area | State | Check |
| --- | --- | --- |
| Scope | NFL only; no betting/odds MVP | [AGENTS.md](AGENTS.md) |
| Phase 1 | Contracts + docs complete | below |
| Phase 2 | **Complete locally** — 2023 historical ingest + ordered play replay | reproduce commands below |
| Phase 2 product scope | **Historical replay only** | not a decision lab |
| Decision lab (4th / clock / strategy) | Planned **Phase 6** after EP/EPA/WP + sim | [ROADMAP.md](ROADMAP.md) |
| Models trained | **Not started** | do not treat as validated |
| Next milestone | Phase 3 Stage A EP → EPA (after your approval) | [ROADMAP.md](ROADMAP.md) |

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

## What works (Phase 2)

1. `python -m nfl_sim.ingest --season 2023` downloads via nflreadpy 0.1.5, writes immutable raw Parquet + `manifest.json` (URL, UTC timestamp, package version, sha256, row count), projects canonical games/plays Parquet, builds DuckDB.
2. FastAPI: `GET /games`, `GET /games/{id}`, `GET /games/{id}/plays` (ordered, paginated). Reference ep/epa/wp nested under `reference` with disclaimer.
3. Next.js Game Explorer lists 2023 games and replays PBP with **Historical** truth chips; does not imply project-trained models.
4. Known game replay verified: `2023_01_DET_KC` (DET @ KC, week 1).

### Reproduce

```bash
cd backend
python3 -m pip install -e ".[dev,phase2]"
python -m nfl_sim.ingest --season 2023
pytest -q
python -m nfl_sim.api          # http://127.0.0.1:8000

cd ../frontend
npm install
npm run typecheck && npm test
npm run dev                    # http://localhost:3000/games
```

### Tests last run (this agent)

| Suite | Result |
| --- | --- |
| Backend `pytest` | **16 passed** (contracts, derive/project, API, real 2023 integration) |
| Frontend `npm test` | **2 passed** (contract shapes) |
| Frontend `npm run typecheck` | **pass** |
| Frontend `npm run build` | **pass** |

### Data pin note

nflverse release tag `pbp` is mutable. Phase 2 pin for 2023: sha256 `b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d`, **49,665** rows (same row count as Phase 1 DATA_EXPERIMENT; digest drifted from earlier `bd348473…`). Manifest records retrieval timestamp and prior pin.

---

## Limitations

- Only **2023** ingested (not full 2019–2023 backfill).
- No situation-at-play dedicated endpoint beyond fields on each play row.
- No trained EP/EPA/WP models; UI shows imported reference columns only.
- No live providers.
- **No** clock management, 4th-down go/punt/FG, or strategy comparison UI/API (Phase 6).
- GitHub push/PR requires `GH_TOKEN` / `gh auth` (no chat-pasted tokens).

---

## What is explicitly NOT done

- Trained/calibrated EP, EPA, or WP models  
- Live data providers  
- Full Strategy Lab UI  
- Fourth-down / clock **recommendations** (Phase 6)  
- Phase 3+  

---

## Decisions still needed from you

1. Approve Phase 2 before Phase 3 (EP/EPA training)  
2. Whether to backfill 2019–2022 next or go straight to Phase 3 on 2023 test season  
3. Use environment secret `GH_TOKEN` for pushes (rotate any chat-pasted PAT)  

---

## Product goal — situational decisions (later)

Answer **what to do** in situations (clock management, 4th-down go/punt/FG, and similar), not only replay history. That is **Phase 6 (Strategy / decision lab)** after historical replay, validated EP/EPA, WP, and seeded simulation. Until then, those choices stay design requirements — not fake recommendations. See [ROADMAP.md](ROADMAP.md).

**Phase 2 delivers historical game selection + ordered play inspection only.**
