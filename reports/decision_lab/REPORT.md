# Historical fourth-down decision lab

**Command:** `python3 -m nfl_sim.models decision-lab --seasons 2022 --game-id 2022_01_BAL_NYJ --play-id 368.0 --model ../reports/wp/artifacts/wp_model.joblib`

> **Offline estimate disclaimer:** Values are model counterfactuals from Path A uncalibrated WP + REG train empirics — **not** historical fact, live odds, or betting advice. No sportsbook/exchange inputs.

## Frozen historical play

* Season / week: `2022` / `1`
* game_id / play_id: `2022_01_BAL_NYJ` / `368.0`
* Possession: `BAL` vs `NYJ` (home `NYJ`)
* Historical play_type: `punt` (mapped action: `punt`)
* Truth: **historical** observation (not a model recommendation)

## Game state (frozen)

| Field | Value |
| --- | ---: |
| score_differential | 0 |
| yardline_100 | 51 |
| distance (ydstogo) | 1 |
| game_seconds_remaining | 3296 |
| half_seconds_remaining | 1496 |
| qtr | 1 |

## Empirics (visible with values)

* Training seasons: `[2019, 2020, 2021]` (REG only; **not** 2023+)
* Sample sizes: n_go=2041, n_fg=2970, n_punt=6102

## Model action values (counterfactual)

| Action | WP value |
| --- | ---: |
| go | 0.5951 |
| fg | 0.5082 |
| punt | 0.5353 |

**Recommendation:** `go` (margin=0.0597; inconclusive=False)

### Assumptions

* Path A uncalibrated WP only (no isotonic)
* Clock −6s per branch
* FG distance = yardline_100 + 17; kickoff TB → yardline_100=75
* Go fail / FG miss → opponent at 100−yardline_100
* Punt → empirical mean opponent yardline (blocked punts excluded from fit)
* Empirics fit REG train 2019–2021 only

### Limitations (not invented away)

* Toy clock (−6s per branch); no timeout / OT / onside strategy
* Coarse FG make bins; miss spot ≈ previous LOS; kickoff TB proxy at 75
* Punt → mean opponent yardline only (no return variance / blocked branch)
* Conversion rates are distance bins from 2019–2021 REG only
* Margin < 0.01 WP → inconclusive (do not manufacture confidence)

## Sensitivity

Convert Δ=-0.35, make Δ=+0.0.

| | go | FG | punt | recommendation |
| --- | ---: | ---: | ---: | --- |
| Baseline | 0.5951 | 0.5082 | 0.5353 | go |
| Alternate | 0.5171 | 0.5082 | 0.5353 | punt |

Recommendation changed: **True**

## Notes

* Action values reuse FourthDownAnalyzer (Path A WP + train empirics); not reimplemented here.
* Historical play_type is observation only; recommendation is model counterfactual.
* Offline / read-only: no live feeds, odds, or betting.
* Empirics seasons=[2019, 2020, 2021]; n_go=2041, n_fg=2970, n_punt=6102 (never 2023+).
* Historical action was 'punt'; model recommendation is 'go'.
