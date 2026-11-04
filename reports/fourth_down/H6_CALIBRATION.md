# H6: 4th-down engine calibration check (2026-10-28)

Model: `backend/tests/fixtures/grid_engine/wp_model.joblib` (the one grid.json and the Daily pack use;
logistic, score×time feature, fit on 2019–21). Holdout: 2024–25 REG+POST WP-eligible plays
(`tests/fixtures/wp_holdout/holdout_2024_25.npz`), never used for fitting or choosing a calibrator.

| Slice | n | Engine Brier | Engine ECE | nflverse `wp` Brier | nflverse ECE |
|---|---:|---:|---:|---:|---:|
| 2024–25 all plays | 78,324 | 0.1654 | 0.0100 | 0.1646 | 0.0137 |
| 2024–25 4th downs | 8,163 | 0.1617 | 0.0164 | 0.1609 | 0.0177 |
| 2022–23 all (calibration set) | 79,378 | 0.1777 | 0.0284 | 0.1746 | 0.0138 |

Mean |engine − nflverse| is 4.1 pts with a +0.2–0.5 pt bias, not the 8–10 pts reported before #91.

## Recalibrators tried (fit on 2022–23, scored on 2024–25 all plays)

| Calibrator | Brier | ECE |
|---|---:|---:|
| none (shipped) | 0.16539 | 0.0100 |
| Platt on outcomes | 0.16565 | 0.0166 |
| isotonic on outcomes | 0.16560 | 0.0179 |
| isotonic to nflverse `wp` | 0.16535 | 0.0100 |

2022–23 ran more overconfident than 2024–25, so fitting a calibrator on it makes the holdout worse.
Mapping to nflverse's `wp` is neutral (−0.00004 Brier). The repo rule is to keep the
uncalibrated model as the default and not persist isotonic, so the model, grid.json and the pack stay as they are.
`tests/test_engine_calibration_holdout.py` now gates this in CI.

Still open: the strict-xfail Q3 post-punt gap in `test_engine_vs_nflverse.py` (the engine is about 4 pts
off nflverse there, and nflverse itself is about 6 pts above the real outcome).
