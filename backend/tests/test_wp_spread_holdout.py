"""Spread WP model: holdout Brier gate on 2024–25 (CI, no lake needed).

Fixture: tests/fixtures/wp_holdout/holdout_2024_25.npz (scripts/build_wp_holdout_fixture.py).
Model: tests/fixtures/wp_spread/wp_spread_model.joblib, a separate artifact used only for real games
with a known spread. The generic engine and grid.json keep the no-spread model.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import brier_score_loss

from nfl_sim.models.features import assert_no_leakage_columns
from nfl_sim.models.wp_features import WP_PREGAME_FEATURES, build_wp_feature_frame
from nfl_sim.models.wp_model import WP_HOLDOUT_BRIER_MAX, WP_HOLDOUT_SEASONS, WPModel

FX = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="module")
def model() -> WPModel:
    return WPModel.load(FX / "wp_spread" / "wp_spread_model.joblib")


def _holdout() -> pd.DataFrame:
    z = np.load(FX / "wp_holdout" / "holdout_2024_25.npz")
    df = pd.DataFrame({k: z[k] for k in z.files})
    df["posteam"] = np.where(df.pop("is_home") == 1, "H", "A")
    df["home_team"] = "H"
    return df


def test_model_uses_pregame_spread(model):
    assert set(WP_PREGAME_FEATURES) <= set(model.feature_builder.columns)
    assert set(model.meta["train_seasons"]) == {2019, 2020, 2021, 2022, 2023}
    assert not set(model.meta["train_seasons"]) & set(WP_HOLDOUT_SEASONS)


def test_holdout_brier_2024_25_at_most_0150(model):
    df = _holdout()
    assert set(df["season"].unique()) == set(WP_HOLDOUT_SEASONS) and len(df) > 70_000
    brier = brier_score_loss(df["label"], model.predict_wp(df))
    assert brier <= WP_HOLDOUT_BRIER_MAX, f"holdout Brier {brier:.4f} > {WP_HOLDOUT_BRIER_MAX}"


def test_spread_decays_to_nothing_at_the_final_whistle():
    df = pd.DataFrame({"score_differential": [0, 0], "game_seconds_remaining": [3600, 0],
                       "half_seconds_remaining": [1800, 0], "down": [1, 1], "ydstogo": [10, 10],
                       "yardline_100": [75, 75], "posteam_timeouts_remaining": [3, 3],
                       "defteam_timeouts_remaining": [3, 3], "posteam": ["H", "H"], "home_team": ["H", "H"],
                       "receive_2h_ko": [0, 0], "posteam_spread": [7.0, 7.0]})
    X = build_wp_feature_frame(df)
    assert X["posteam_spread_decayed"].tolist() == pytest.approx([7.0, 7.0 * np.exp(-4)])


def test_what_if_states_without_a_matchup_are_even():
    df = pd.DataFrame({"score_differential": [3], "game_seconds_remaining": [900], "half_seconds_remaining": [900],
                       "down": [4], "ydstogo": [1], "yardline_100": [40], "posteam_timeouts": [3],
                       "defteam_timeouts": [3], "posteam": ["H"], "home_team": ["H"], "receive_2h_ko": [0]})
    X = build_wp_feature_frame(df)
    assert X[list(WP_PREGAME_FEATURES)].iloc[0].tolist() == [0.0, 0.0]


def test_raw_odds_columns_stay_banned():
    for col in ("spread_line", "total_line", "vegas_wp", "spread_raw"):
        with pytest.raises(ValueError):
            assert_no_leakage_columns([col])


def test_generic_grid_model_has_no_spread_input():
    grid = WPModel.load(FX / "grid_engine" / "wp_model.joblib")
    assert not set(WP_PREGAME_FEATURES) & set(grid.feature_builder.columns)
