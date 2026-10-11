# Empirics mode comparison (same frozen lake play)

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 790.0 --empirics-mode pooled --compare-modes --model /agent/repos/nfl-analytics-simulator/reports/wp/artifacts/wp_model.joblib`

> Offline counterfactual only — not live odds or betting advice.

* game_id / play_id: `2022_01_BAL_NYJ` / `790.0`
* Historical play_type: `field_goal`
* State: yl=6 &3, sd=0, clock=2899

| Mode | go | FG | punt | rec | p_convert | table |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| pooled | 0.6511 | 0.6496 | 0.5447 | inconclusive | 0.4690 | pooled |
| season_aware | 0.6261 | 0.6507 | 0.5424 | fg | 0.3455 | 2021 |

Recommendation changed: **True**

Value deltas (season_aware − pooled): `{'go': -0.024996684594563168, 'fg': 0.001098348294493623, 'punt': -0.002292099476624787}`

Pooled resolve: `Pooled REG train empirics`
Season-aware resolve: `Play season 2022 not in fit set; using most recent train table 2021 (no 2023+ fit)`
