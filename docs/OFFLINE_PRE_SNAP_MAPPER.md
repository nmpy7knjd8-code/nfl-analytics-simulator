# Offline pre-snap mapper (Phases 2–5)

**Date:** 2026-10-11  
**Authorized:** P-CL / P-FC / P-YL Accept + **M** (offline only) @ main `b483ac0d`  
**Not authorized:** T, HTTP, vendor, live feed, odds, betting  
**Branch:** `cursor/offline-presnap-mapper-c0ef` (PR unmerged until approval)
**Docs PR (unmerged):** https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/24  
**Public delta:** https://raw.githubusercontent.com/nmpy7knjd8-code/nfl-analytics-simulator/7648fbfb84b36669280be6aebfc19de1e92dcb89/docs/NEXT_STEPS_DELTA_OFFLINE_PRE_SNAP_MAPPER.md

## What works

Offline `offline_provider_frame.v1` JSON (fixture/demo) → alias normalize (game-scoped) → yardline Y1–Y15 → `receive_2h_ko.fail_closed.v1` → `pre_snap_snapshot.v1` → existing adapter → Situation Lab go/FG/punt.

| Piece | Path |
| --- | --- |
| Mapper | `backend/src/nfl_sim/providers/offline_mapper.py` |
| Bundled frames | `backend/src/nfl_sim/providers/fixtures/offline_mapper/` |
| API | `GET …/offline-mapper/frames`, `…/map/{id}`, `…/compare/{id}`; `POST …/offline-mapper/compare` |
| Tests | `backend/tests/test_offline_mapper.py` (Y1–Y15, S1–S5, C-cases, E2E) |

**Locked:** `provider` ∈ {`fixture`,`demo`}; Path A unsupported; unknown aliases/enums rejected; `live_feed=false`; no prior `configs` on reject.

## How to run

```bash
cd backend
python3 -m pytest tests/test_offline_mapper.py -v
# related regression:
python3 -m pytest tests/test_offline_mapper.py tests/test_pre_snap_adapter.py tests/test_recorded_demo.py tests/test_situation_lab_api.py -q
```

Score a bundled frame:

```text
GET /situation-lab/api/offline-mapper/compare/kc-den-q4-own-25
```

## Limitations

* No Sportradar HTTP / Simulations (**T** not authorized).
* `receive_2h_ko` must be present on the offline frame (fail-closed if missing); no Path A/C.
* Alias table is game-scoped (home/away); nicknames rejected.
* Clocks: explicit seconds preferred; optional `MM:SS` + quarter heuristic for offline fixtures only.
* UI HTML not extended with a new mode selector (API + tests cover E2E).

## Preserve

Recorded-demo (`lac-den-q4-demo`) and historical Situation Lab paths unchanged.
