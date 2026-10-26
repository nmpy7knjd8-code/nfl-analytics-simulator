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


def test_calibrated_wp_artifact_round_trip(tmp_path):
    import json

    import pandas as pd

    from nfl_sim.models.wp_calibration import CalibratedWPModel
    from nfl_sim.models.wp_model import WPModel

    rng = np.random.default_rng(1)
    rows = []
    for k in range(120):
        home_win = k % 2 == 0
        posteam_home = k % 3 != 0
        rows.append(
            {
                "game_id": f"g{k // 4}", "play_id": k, "season": 2019, "season_type": "REG",
                "qtr": 1 + (k % 4), "down": int(rng.integers(1, 5)), "ydstogo": int(rng.integers(1, 15)),
                "yardline_100": int(rng.integers(1, 99)),
                "half_seconds_remaining": int(rng.integers(60, 1800)),
                "game_seconds_remaining": int(rng.integers(60, 3600)),
                "score_differential": int(rng.integers(-14, 15)),
                "posteam": "H" if posteam_home else "A", "defteam": "A" if posteam_home else "H",
                "home_team": "H", "away_team": "A",
                "posteam_timeouts_remaining": 3, "defteam_timeouts_remaining": 3,
                "home_score": 24 if home_win else 17, "away_score": 17 if home_win else 24,
                "wp_label": int((posteam_home and home_win) or ((not posteam_home) and (not home_win))),
            }
        )
    df = pd.DataFrame(rows)
    base = WPModel().fit(df, C=1.0)
    p_raw = base.predict_wp(df)
    y = df["wp_label"].to_numpy()
    for method in ("platt", "isotonic"):
        cal = CalibratedWPModel.fit(base, p_raw, y, method=method)
        path = tmp_path / f"{method}.joblib"
        meta = tmp_path / f"{method}.meta.json"
        cal.save(path, meta_path=meta)
        loaded = CalibratedWPModel.load(path)
        np.testing.assert_allclose(loaded.predict_wp(df), cal.predict_wp(df))
        p = loaded.predict_wp(df)
        assert np.all((p >= 0) & (p <= 1))
        assert json.loads(meta.read_text())["method"] == method
