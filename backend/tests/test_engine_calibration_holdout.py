"""H6 gate: the 4th-down engine's WP model is calibrated on the 2024–25 holdout (CI, no lake).

The engine and grid.json use tests/fixtures/grid_engine/wp_model.joblib (fit on 2019–21 only).
Measured 2026-10-28 on tests/fixtures/wp_holdout/holdout_2024_25.npz:
  all plays  n=78,324  Brier 0.1654  ECE(10 bins) 0.0100   (nflverse wp: 0.1646 / 0.0137)
  4th downs  n=8,163   Brier 0.1617  ECE(10 bins) 0.0164   (nflverse wp: 0.1609 / 0.0177)
Recalibrators fit on 2022–23 (Platt, isotonic to outcomes, isotonic to nflverse wp) did not beat
this on the holdout (best: Brier 0.16535, ECE 0.0100), so the uncalibrated model stays the default
(see reports/fourth_down/H6_CALIBRATION.md). These gates fail if a future refit drifts.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import brier_score_loss

from nfl_sim.models.wp_model import WPModel

FX = Path(__file__).parent / "fixtures"


def ece(p: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    b = np.minimum((p * bins).astype(int), bins - 1)
    return float(sum(abs(p[b == i].mean() - y[b == i].mean()) * (b == i).mean() for i in range(bins) if (b == i).any()))


@pytest.fixture(scope="module")
def scored():
    z = np.load(FX / "wp_holdout" / "holdout_2024_25.npz")
    df = pd.DataFrame({k: z[k] for k in z.files})
    df["posteam"] = np.where(df.pop("is_home") == 1, "H", "A")
    df["home_team"] = "H"
    m = WPModel.load(FX / "grid_engine" / "wp_model.joblib")
    assert not set(m.meta["train_seasons"]) & {2024, 2025}
    return m.predict_wp(df), df["label"].to_numpy(), df["down"].to_numpy()


def test_engine_holdout_calibration_all_plays(scored):
    p, y, _ = scored
    assert brier_score_loss(y, p) <= 0.167
    assert ece(p, y) <= 0.015


def test_engine_holdout_calibration_fourth_downs(scored):
    p, y, down = scored
    k = down == 4
    assert k.sum() > 7000
    assert brier_score_loss(y[k], p[k]) <= 0.165
    assert ece(p[k], y[k]) <= 0.022


def test_no_decile_is_off_by_more_than_5_pts(scored):
    p, y, _ = scored
    b = np.minimum((p * 10).astype(int), 9)
    worst = max(abs(p[b == i].mean() - y[b == i].mean()) for i in range(10))
    assert worst <= 0.05, f"worst decile gap {worst:.3f}"
