# Transition mode comparison (same frozen lake play)

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_18_LAC_DEN --play-id 3897.0 --empirics-mode pooled --transition-mode legacy --compare-transitions --model /agent/repos/nfl-analytics-simulator/reports/wp/artifacts/wp_model.joblib`

> Offline counterfactual — variance-aware punt + outcome clock vs mean-punt/toy-clock.

* game_id / play_id: `2022_18_LAC_DEN` / `3897.0`
* Historical play_type: `punt`
* State: yl=64 &14, sd=-3, clock=207

Improved clock deltas (median s): `{'go_convert': 29, 'go_fail': 5, 'fg_make': 4, 'fg_miss': 5, 'punt': 9}`

| Config | go | FG | punt | rec |
| --- | ---: | ---: | ---: | --- |
| pooled + legacy | 0.3239 | 0.3352 | 0.3449 | inconclusive |
| season_aware + legacy | 0.3118 | 0.3682 | 0.3449 | fg |
| pooled + improved | 0.3238 | 0.3352 | 0.3465 | punt |

Legacy→improved recommendation changed: **True**

Value deltas (improved − legacy): `{'go': -3.726739375592425e-05, 'fg': -7.2807250675599455e-06, 'punt': 0.0016474605402267972}`
