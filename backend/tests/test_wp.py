"""WP labels, leakage, split integrity, and toy train."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.constants import FORBIDDEN_EXACT
from nfl_sim.models.features import assert_no_leakage_columns
from nfl_sim.models.split import forbid_test_season_in_fit
from nfl_sim.models.wp_features import build_wp_feature_frame
from nfl_sim.models.wp_labels import construct_win_labels, wp_eligible_mask
from nfl_sim.models.wp_model import ConstantWinBaseline, WPModel


def _mini_game_decided() -> pd.DataFrame:
    """Home KC wins 24-17; mix of possession and a tie-game exclusion case elsewhere."""
    rows = []
    base = {
        "game_id": "2022_01_DET_KC",
        "season": 2022,
        "season_type": "REG",
        "qtr": 1,
        "down": 1,
        "ydstogo": 10,
        "yardline_100": 75,
        "half_seconds_remaining": 1800,
        "game_seconds_remaining": 3600,
        "score_differential": 0,
        "posteam_score": 0,
        "defteam_score": 0,
        "home_score": 0,
        "away_score": 0,
        "posteam": "DET",
        "defteam": "KC",
        "home_team": "KC",
        "away_team": "DET",
        "posteam_timeouts_remaining": 3,
        "defteam_timeouts_remaining": 3,
        "roof": "outdoors",
        "play_type": "pass",
    }
    rows.append({**base, "play_id": 10})
    rows.append(
        {
            **base,
            "play_id": 20,
            "qtr": 3,
            "half_seconds_remaining": 900,
            "game_seconds_remaining": 900,
            "posteam": "KC",
            "defteam": "DET",
            "score_differential": 7,
            "posteam_score": 14,
            "defteam_score": 7,
            "home_score": 14,
            "away_score": 7,
        }
    )
    rows.append(
        {
            **base,
            "play_id": 30,
            "qtr": 4,
            "half_seconds_remaining": 60,
            "game_seconds_remaining": 60,
            "posteam": "DET",
            "defteam": "KC",
            "score_differential": -7,
            "posteam_score": 17,
            "defteam_score": 24,
            "home_score": 24,
            "away_score": 17,
        }
    )
    return pd.DataFrame(rows)


def test_win_labels_posteam_perspective():
    df = _mini_game_decided()
    labels = construct_win_labels(df)
    # Final: KC 24, DET 17 — KC home wins
    assert labels.iloc[0] == 0  # DET possession, DET loses
    assert labels.iloc[1] == 1  # KC possession, KC wins
    assert labels.iloc[2] == 0  # DET possession, DET loses


def test_ties_dropped_from_eligibility():
    df = _mini_game_decided()
    df["home_score"] = 17
    df["away_score"] = 17
    labels = construct_win_labels(df)
    assert labels.isna().all()
    assert not wp_eligible_mask(df, labels).any()


def test_wp_eligible_requires_score_and_clock():
    df = _mini_game_decided()
    labels = construct_win_labels(df)
    assert wp_eligible_mask(df, labels).all()
    bad = df.copy()
    bad.loc[0, "game_seconds_remaining"] = np.nan
    mask = wp_eligible_mask(bad, labels)
    assert not mask.iloc[0]


def test_wp_leakage_guard():
    with pytest.raises(ValueError, match="Leakage"):
        assert_no_leakage_columns(["score_differential", "vegas_wp"])
    with pytest.raises(ValueError, match="Leakage"):
        assert_no_leakage_columns(["wp"])
    feats = build_wp_feature_frame(_mini_game_decided())
    assert not any(c in FORBIDDEN_EXACT for c in feats.columns)
    assert "score_differential" in feats.columns
    assert "receive_2h_ko" in feats.columns


def test_receive_2h_ko_zero_outside_first_half():
    df = _mini_game_decided()
    feats = build_wp_feature_frame(df)
    # play 20/30 are Q3/Q4 → encoded 0
    assert feats.loc[1, "receive_2h_ko"] == 0.0
    assert feats.loc[2, "receive_2h_ko"] == 0.0


def test_wp_forbids_2023_in_fit():
    with pytest.raises(ValueError, match="Test-season leakage"):
        forbid_test_season_in_fit([2019, 2023], context="train_fit")


def test_wp_toy_train_proba_bounds():
    rng = np.random.default_rng(0)
    rows = []
    for k in range(80):
        home_win = k % 2 == 0
        posteam_home = k % 3 != 0
        rows.append(
            {
                "game_id": f"g{k // 4}",
                "play_id": k,
                "season": 2019,
                "season_type": "REG",
                "qtr": 1 + (k % 4),
                "down": int(rng.integers(1, 5)),
                "ydstogo": int(rng.integers(1, 15)),
                "yardline_100": int(rng.integers(1, 99)),
                "half_seconds_remaining": int(rng.integers(60, 1800)),
                "game_seconds_remaining": int(rng.integers(60, 3600)),
                "score_differential": int(rng.integers(-14, 15)),
                "posteam": "H" if posteam_home else "A",
                "defteam": "A" if posteam_home else "H",
                "home_team": "H",
                "away_team": "A",
                "posteam_timeouts_remaining": 3,
                "defteam_timeouts_remaining": 3,
                "home_score": 24 if home_win else 17,
                "away_score": 17 if home_win else 24,
                "wp_label": int((posteam_home and home_win) or ((not posteam_home) and (not home_win))),
            }
        )
    df = pd.DataFrame(rows)
    model = WPModel().fit(df, C=1.0)
    p = model.predict_wp(df)
    assert np.all((p >= 0) & (p <= 1))
    assert abs(float(p.mean()) - 0.5) < 0.35
    base = ConstantWinBaseline().fit(df["wp_label"])
    assert 0.0 < base.p_ < 1.0


def test_score_differential_inconsistency_filtered():
    df = _mini_game_decided()
    df.loc[0, "posteam_score"] = 99
    df.loc[0, "defteam_score"] = 0
    df.loc[0, "score_differential"] = 0  # inconsistent with 99-0
    labels = construct_win_labels(df)
    mask = wp_eligible_mask(df, labels)
    assert not mask.iloc[0]
