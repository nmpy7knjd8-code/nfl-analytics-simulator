# Delta summary + next steps (after WP Path A prototype)

**Date:** 2026-10-11  
**Branch tip:** `cursor/wp-prototype-8ade`  
**Base:** `main` @ `559e7dc`

## What landed

* Path A situation WP (logistic): train 2019–2021, select C on 2022, report-only 2023
* Spec, leakage/split tests, constant + score/time baselines, `reports/wp/` metrics from a real run
* EP labeled rebuild SHA verified; **not** loaded; Convention B untouched

## Headline numbers (validate 2022)

| Model | Log loss | Brier |
| --- | ---: | ---: |
| WP logistic (C=0.25) | 0.575 | 0.196 |
| Score+time baseline | 0.579 | 0.198 |
| Constant | 0.693 | 0.250 |

Full write-up: [`reports/wp/EVALUATION.md`](../reports/wp/EVALUATION.md)

## Approvals / decisions still open

1. Merge WP prototype PR when review is satisfied  
2. Keep EP labeled rebuild isolated vs promote later (still open; not required for Path A)  
3. Close PR #5 separately (superseded by #7) — not part of WP  
4. Whether to pursue Path B (EP-as-feature via **explicit** joblib path only)

## Single best next step

**Calibrate on validate 2022 only** (e.g. sklearn `CalibratedClassifierCV` / isotonic on val folds that never see 2023) and re-report Brier/log-loss vs the current linear WP — or, if calibration is already acceptable in `calibration_val.csv`, authorize a thin analytical 4th-down Milestone C design that consumes WP (+ EP via explicit path) with disclosed simplifications.

## Out of scope until authorized

External WP benchmarks, live providers, odds features, silent EP retrain/promotion, tuning on 2023–2025.
