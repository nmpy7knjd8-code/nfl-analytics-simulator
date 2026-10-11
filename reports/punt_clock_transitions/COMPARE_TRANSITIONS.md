# Transition mode comparison (same frozen lake play)

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368.0 --empirics-mode pooled --transition-mode legacy --compare-transitions --model /agent/repos/nfl-analytics-simulator/reports/wp/artifacts/wp_model.joblib`

> Offline counterfactual — variance-aware punt + outcome clock vs mean-punt/toy-clock.

* game_id / play_id: `2022_01_BAL_NYJ` / `368.0`
* Historical play_type: `punt`
* State: yl=51 &1, sd=0, clock=3296

Improved clock deltas (median s): `{'go_convert': 29, 'go_fail': 5, 'fg_make': 4, 'fg_miss': 5, 'punt': 9}`

| Config | go | FG | punt | rec |
| --- | ---: | ---: | ---: | --- |
| pooled + legacy | 0.5951 | 0.5082 | 0.5353 | go |
| season_aware + legacy | 0.6013 | 0.5386 | 0.5330 | go |
| pooled + improved | 0.5950 | 0.5082 | 0.5348 | go |

Legacy→improved recommendation changed: **False**

Value deltas (improved − legacy): `{'go': -8.611761539079055e-05, 'fg': -7.842928763324153e-06, 'punt': -0.0005666059252356082}`
