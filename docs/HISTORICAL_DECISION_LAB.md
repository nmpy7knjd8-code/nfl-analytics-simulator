# Historical fourth-down decision lab

**Date:** 2026-10-11  
**Depends on:** PR #9 fourth-down scorer on `main` (`FourthDownAnalyzer`)  
**Scope:** Offline, read-only. No live feeds, odds, betting, or fan-UI.

## What it does

1. Select a real 4th-down row from the pinned nflverse lake  
2. Freeze provenance + pre-snap game state  
3. Score go / FG / punt by **reusing** `FourthDownAnalyzer` (no duplicated transition math)  
4. Show recommendation or **inconclusive**, assumptions, and a convert/make sensitivity check  

## Command

```bash
# List candidates
cd backend && python3 -m nfl_sim.models decision-lab --seasons 2022 --list

# End-to-end: pick by game_id + play_id
python3 -m nfl_sim.models decision-lab \
  --seasons 2022 \
  --game-id 2022_01_JAX_WAS \
  --play-id 3013 \
  --model ../reports/wp/artifacts/wp_model.joblib \
  --out ../reports/decision_lab

# Or by index into the filtered frame
python3 -m nfl_sim.models decision-lab --seasons 2022 --index 0 --out ../reports/decision_lab
```

Requires local lake (`python -m nfl_sim.ingest --seasons …`) and Path A WP artifact (`wp-train`).

## Truth labels

| Surface | Label |
| --- | --- |
| Lake play_type / result | **historical** |
| go / FG / punt WP values | **model counterfactual** |
| Recommendation | **model counterfactual** |

## Code

* Lab orchestration: `backend/src/nfl_sim/models/decision_lab.py`  
* CLI: `python -m nfl_sim.models decision-lab`  
* Scorer (unchanged reuse): `fourth_down.py` / `fourth_down_empirics.py`  
* Tests: `backend/tests/test_decision_lab.py`

## Example (real lake row)

`2022_01_BAL_NYJ` play_id `368` — BAL 4th & 1 at yl 51, tied, Q1 (~3296 game seconds). Historical action: **punt**.

| | go | FG | punt | rec |
| --- | ---: | ---: | ---: | --- |
| Baseline | 0.5951 | 0.5082 | 0.5353 | go |
| Convert −35 pp | 0.5171 | 0.5082 | 0.5353 | punt |

Empirics shown with values: seasons `[2019, 2020, 2021]`; n_go=2041, n_fg=2970, n_punt=6102.

## Non-goals (this PR)

* Live / sportsbook / exchange odds  
* Fan-facing UI workstream  
* Convention B, EP artifact promotion, isotonic WP persist  
* Richer transition models (season-aware convert / FG / punt) — next improvement
