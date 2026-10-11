# Offline 4th-down prototype report

**Command:** `python3 -m nfl_sim.models fourth-down --report --model ../reports/wp/artifacts/wp_model.joblib --out ../reports/fourth_down`

**WP model:** `../reports/wp/artifacts/wp_model.joblib` — Path A uncalibrated primary; isotonic not loaded

## Empirics

Seasons: `[2019, 2020, 2021]` (REG; n_go=2041, n_fg=2970, n_punt=6102). **Not fit on 2023+.**

See `empirics.json` for bin rates and n.

## Example situations

| yardline_100 | distance | score_diff | clock | go | FG | punt | rec | margin |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 55 | 1 | 0 | 360 | 0.5195 | 0.4398 | 0.4709 | go | 0.0486 |
| 33 | 4 | -3 | 120 | 0.3953 | 0.3936 | 0.3411 | inconclusive | 0.0017 |
| 70 | 2 | 4 | 600 | 0.6528 | 0.5966 | 0.6283 | go | 0.0245 |
| 20 | 8 | 0 | 90 | 0.5430 | 0.5802 | 0.4795 | fg | 0.0372 |

## Sensitivity (recommendation flip check)

Convert Δ=-0.35, make Δ=+0.0.

| | go | FG | punt | recommendation |
| --- | ---: | ---: | ---: | --- |
| Baseline | 0.5195 | 0.4398 | 0.4709 | go |
| Alternate | 0.4438 | 0.4398 | 0.4709 | punt |

Recommendation changed: **True**

## Limitations

- Toy clock (−6s); no timeout/OT/onside model
- Single mean punt field position (no return variance / blocks)
- FG miss spot ≈ previous LOS; kickoff always TB at 75
- Conversion/FG probs are coarse bins from 2019–2021 only
- Margin < 0.01 WP → inconclusive (do not manufacture confidence)

Design: `docs/FOURTH_DOWN_DESIGN.md`
