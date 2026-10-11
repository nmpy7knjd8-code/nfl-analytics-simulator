"""WP calibration protocol: OOF primary, no 2023, freeze C."""

from __future__ import annotations

import numpy as np

from nfl_sim.models.wp_calibration import oof_calibrate, in_sample_calibrate


def test_oof_platt_changes_probs_and_stays_in_unit_interval():
    rng = np.random.default_rng(0)
    # Systematic miscalibration: raw p too extreme
    y = np.array([0, 0, 0, 0, 1, 1, 1, 1] * 20)
    p = np.where(y == 1, 0.9, 0.1).astype(float)
    p = np.clip(p + rng.normal(0, 0.02, size=len(p)), 0.01, 0.99)
    oof = oof_calibrate(p, y, method="platt", n_splits=4)
    assert oof.shape == p.shape
    assert np.all((oof >= 0) & (oof <= 1))
    # Should not be identical copy of raw under structured miscalibration
    assert float(np.mean(np.abs(oof - p))) > 1e-4


def test_in_sample_secondary_runs():
    y = np.array([0, 1, 0, 1, 0, 1, 0, 1] * 10)
    p = np.linspace(0.1, 0.9, len(y))
    out = in_sample_calibrate(p, y, method="platt")
    assert out.shape == p.shape
    assert np.all((out >= 0) & (out <= 1))
