# WP prototype evaluation

**Command:** `python3 -m nfl_sim.models wp-train --out /workspace/nfl-h6/reports/wp`

**Spec:** `docs/WP_MODEL_SPEC.md`
**Path:** A_no_ep_feature (EP joblib not loaded)
**Selected C:** 0.25 (tuned on validate 2022 only)

## Packages

```json
{
  "scikit-learn": "1.9.1",
  "numpy": "2.5.4",
  "pandas": "3.1.0",
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
  "test": 118355,
  "labeled_total": 273348
}
```

## Validate 2022

| Estimator | Log loss | Brier |
| --- | ---: | ---: |
| WP logistic | 0.569844 | 0.194710 |
| Constant baseline | 0.692984 | 0.249919 |
| Score+time baseline | 0.578554 | 0.197988 |

n=39347, empirical win rate=0.5093

## Target / terminal / end-of-half

See `docs/WP_MODEL_SPEC.md` §3. Win label = posteam eventual game winner; ties dropped. Half boundaries do not reset the target. `receive_2h_ko` encoded 0 outside first half.

## Artifacts

- `artifacts/wp_model.joblib` (gitignored binary)
- `artifacts/wp_model.meta.json`
- `metrics.json`
- `calibration_val.csv`
