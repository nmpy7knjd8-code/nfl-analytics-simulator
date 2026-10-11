# Delta summary + next steps (WP calibration)

**Date:** 2026-10-11  
**PR:** [#8](https://github.com/nmpy7knjd8-code/nfl-analytics-simulator/pull/8) · branch `cursor/wp-prototype-8ade`

## Measured calibration (validate 2022, OOF primary)

Command: `python3 -m nfl_sim.models wp-calibrate --out ../reports/wp --C 0.25 --folds 5`

| Estimator | Log loss | Brier | ECE (decile) |
| --- | ---: | ---: | ---: |
| Uncalibrated (frozen C=0.25) | 0.574927 | 0.196110 | 0.054501 |
| Platt OOF | 0.571387 | 0.195414 | 0.045597 |
| Isotonic OOF | 0.564082 | 0.192579 | 0.002231 |

* Train 2019–2021 only for base WP; calibrator 5-fold OOF on 2022 only; **no 2023**.  
* Original uncalibrated eval preserved.  
* **Calibration recommendation:** `improved` — keep **isotonic OOF** as a **separate candidate**; do not replace the Path A uncalibrated artifact as the sole report.

## PR #8 merge call

**Ready to merge** for the Path A WP prototype (code + tests + uncalibrated metrics). Calibration tooling/results can land in the same PR; calibrated model is optional follow-on, not a merge blocker.

## Single best next product step

Author a thin **offline analytical 4th-down** module design→impl that scores go / FG / punt via WP transitions, adding empirical conversion / FG-make / punt-net estimates (WP alone cannot supply those). No live/odds.

## Approval needed

1. Merge PR #8 (yes/no).  
2. Whether to persist an isotonic-calibrated WP candidate artifact later (optional; not required before 4th-down design/impl).
