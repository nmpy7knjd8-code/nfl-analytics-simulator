# Empirics mode comparison (same frozen lake play)

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368.0 --empirics-mode pooled --compare-modes --model /agent/repos/nfl-analytics-simulator/reports/wp/artifacts/wp_model.joblib`

> Offline counterfactual only — not live odds or betting advice.

* game_id / play_id: `2022_01_BAL_NYJ` / `368.0`
* Historical play_type: `punt`
* State: yl=51 &1, sd=0, clock=3296

| Mode | go | FG | punt | rec | p_convert | table |
| --- | ---: | ---: | ---: | --- | ---: | --- |
| pooled | 0.5951 | 0.5082 | 0.5353 | go | 0.6511 | pooled |
| season_aware | 0.6013 | 0.5386 | 0.5330 | go | 0.6792 | 2021 |

Recommendation changed: **False**

Value deltas (season_aware − pooled): `{'go': 0.006264832014311605, 'fg': 0.030420471351366496, 'punt': -0.0022988496159299654}`

Pooled resolve: `Pooled REG train empirics`
Season-aware resolve: `Play season 2022 not in fit set; using most recent train table 2021 (no 2023+ fit)`
