"""Empirical baselines fit on train only; evaluated conceptually on 2022."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.baselines import (
    DownDistanceYardBaseline,
    YardlineBinBaseline,
    evaluate_baselines_on_val,
)
from nfl_sim.models.constants import EP_CLASSES


def _rows(season: int, n: int = 70) -> pd.DataFrame:
    rows = []
    for i in range(n):
        cls = EP_CLASSES[i % len(EP_CLASSES)]
        rows.append(
            {
                "game_id": f"g{season}_{i}",
                "play_id": i,
                "season": season,
                "down": (i % 4) + 1,
                "ydstogo": (i % 15) + 1,
                "yardline_100": (i * 3) % 99 + 1,
                "ep_label": cls,
            }
        )
    return pd.DataFrame(rows)


def test_yardline_baseline_fit_predict():
    train = _rows(2019)
    val = _rows(2022)
    m = YardlineBinBaseline().fit(train)
    p = m.predict_proba(val)
    assert p.shape == (len(val), 7)
    assert np.allclose(p.sum(axis=1), 1.0)


def test_ddy_baseline_fit_predict():
    train = _rows(2020)
    val = _rows(2022)
    m = DownDistanceYardBaseline().fit(train)
    p = m.predict_proba(val)
    assert p.shape == (len(val), 7)
    assert np.allclose(p.sum(axis=1), 1.0)


def test_evaluate_baselines_rejects_non_2022_val():
    train = _rows(2019)
    val = _rows(2021)
    with pytest.raises(ValueError, match="2022"):
        evaluate_baselines_on_val(train, val)


def test_evaluate_baselines_on_2022():
    train = pd.concat([_rows(2019), _rows(2020), _rows(2021)], ignore_index=True)
    val = _rows(2022)
    out = evaluate_baselines_on_val(train, val)
    assert "constant_class_prior" in out
    assert "yardline_bin_empirical" in out
    assert "down_distance_yardline_smoothed" in out
    for v in out.values():
        assert v["eval_on"] == "validate_2022"
        assert v["fit_on"] == "train_2019_2021"
