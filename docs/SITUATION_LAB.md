# Situation Lab (offline analyst UI)

**Date:** 2026-10-11  
**Depends on:** PR #13 punt/clock transitions on `main` (`be9b05d`)  
**Branch:** `cursor/situation-lab-ui-c0ef` (PR open, **not merged**)  
**Separate from:** fan-facing Next.js UI (PR #10) — this lab is served by the FastAPI backend.

## What it is

One read-only page over the existing freeze + `compare_transition_modes` harness:

* Select a real lake 4th-down (presets + freeform ids)  
* Show frozen state + provenance  
* Three WP values + recommendation / inconclusive for pooled+legacy, season_aware+legacy, pooled+improved  
* Banner when legacy→improved recommendation changes  
* Assumptions: punt buckets, outcome clock deltas, Path A WP, empirics seasons + n  

Default preset: documented flip `2022_18_LAC_DEN` / `3897`.

## Run

```bash
# lake + WP artifact required (same as decision-lab CLI)
cd backend && python3 -m nfl_sim.api
# open http://127.0.0.1:8000/situation-lab
```

API:

* `GET /situation-lab` — HTML  
* `GET /situation-lab/api/presets`  
* `GET /situation-lab/api/compare?season=2022&game_id=…&play_id=…`

## Code

* `backend/src/nfl_sim/api/situation_lab.py` — routes; calls `compare_transition_modes`  
* `backend/src/nfl_sim/api/static/situation_lab.html` — single-page UI  
* Tests: `backend/tests/test_situation_lab_api.py`

## Non-goals

Fan UI language/chrome; live/odds/betting; Convention B / EP promote / isotonic; merge without approval.
