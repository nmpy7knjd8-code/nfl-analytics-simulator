# WP prototype evaluation

**Command:** `python3 -m nfl_sim.models wp-train --out ../reports/wp --include-test`

**Spec:** `docs/WP_MODEL_SPEC.md`
**Path:** A_no_ep_feature (EP joblib not loaded)
**Selected C:** 0.25 (tuned on validate 2022 only)

## Packages

```json
{
  "scikit-learn": "1.9.1",
  "numpy": "2.5.4",
  "pandas": "3.0.6",
  "joblib": "1.6.0"
}
```

## EP labeled rebuild (not used in Path A)

- Verified SHA-256: `1d4c6736c959baaab7bca8733344e113ecd9989a0a457689f1d45d84c38cf82e`
- Note: SHA verified at store internal/ep-labeled-rebuild/; not loaded for Path A train/eval
- `ep_model_loaded`: `None`

## Counts

```json
{
  "train": 115646,
  "val": 39347,
  "test": 40031,
  "labeled_total": 195024
}
```

## Validate 2022

| Estimator | Log loss | Brier |
| --- | ---: | ---: |
| WP logistic | 0.574927 | 0.196110 |
| Constant baseline | 0.692984 | 0.249919 |
| Score+time baseline | 0.578554 | 0.197988 |

n=39347, empirical win rate=0.5093

## Report-only 2023

| Estimator | Log loss | Brier |
| --- | ---: | ---: |
| WP logistic | 0.486644 | 0.162449 |
| Constant baseline | 0.693043 | 0.249948 |
| Score+time baseline | 0.492174 | 0.164815 |

n=40031. **Not used for selection.**

## Target / terminal / end-of-half

See `docs/WP_MODEL_SPEC.md` §3. Win label = posteam eventual game winner; ties dropped. Half boundaries do not reset the target. `receive_2h_ko` encoded 0 outside first half.

## Artifacts

- `artifacts/wp_model.joblib` (gitignored binary)
- `artifacts/wp_model.meta.json`
- `metrics.json`
- `calibration_val.csv`

## Calibration (validate 2022, OOF primary)

**Command:** `python3 -m nfl_sim.models wp-calibrate --out ../reports/wp --C 0.25 --folds 5`

Base WP frozen at **C=0.25** (train n=115646); calibrator cross-fit on validate 2022 only (n=39347, 5-fold stratified OOF). **2023 not used.** Original uncalibrated eval above is preserved.

| Estimator | Log loss | Brier | ECE (decile) |
| --- | ---: | ---: | ---: |
| Uncalibrated | 0.574927 | 0.196110 | 0.054501 |
| Platt OOF (primary) | 0.571387 | 0.195414 | 0.045597 |
| Platt in-sample (secondary) | 0.571328 | 0.195396 | 0.045900 |
| Isotonic OOF (ablation) | 0.564082 | 0.192579 | 0.002231 |

OOF Platt − uncalibrated: ΔLL=-0.003540, ΔBrier=-0.000697, ΔECE=-0.008904.

**Recommendation:** `improved` — OOF isotonic_oof improves calibration/discrimination vs uncalibrated (ΔLL=+0.0108, ΔBrier=+0.0035, ΔECE=+0.0523); keep calibrated scores as a separate candidate — do not replace the original eval.

Isotonic justified vs Platt: `True`. Preferred calibrator candidate: `isotonic_oof`.

Artifacts: `calibration_eval.json`, `calibration_compare.csv` (plus original `calibration_val.csv` / `metrics.json`).

Packages: `{"joblib": "1.6.0", "numpy": "2.5.4", "pandas": "3.0.6", "scikit-learn": "1.9.1"}`
