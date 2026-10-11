"""EP target construction, leakage, split integrity, EPA transitions."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.constants import EP_CLASSES, FORBIDDEN_EXACT
from nfl_sim.models.epa import compute_epa, model_epa_from_eps
from nfl_sim.models.ep_model import EPModel, ConstantBaseline, expected_points_from_proba
from nfl_sim.models.features import assert_no_leakage_columns, build_feature_frame
from nfl_sim.models.labels import construct_next_score_labels, eligible_mask
from nfl_sim.models.split import forbid_test_season_in_fit


def _mini_game() -> pd.DataFrame:
    """Synthetic half: scrimmage → opponent FG made later → NoScore path for OT-less end."""
    rows = []
    # Play 1: DET 1st & 10 — later KC FG
    rows.append(
        {
            "game_id": "2022_01_DET_KC",
            "play_id": 10,
            "season": 2022,
            "season_type": "REG",
            "qtr": 1,
            "down": 1,
            "ydstogo": 10,
            "yardline_100": 75,
            "half_seconds_remaining": 1800,
            "posteam": "DET",
            "defteam": "KC",
            "home_team": "KC",
            "posteam_timeouts_remaining": 3,
            "defteam_timeouts_remaining": 3,
            "roof": "outdoors",
            "play_type": "pass",
            "touchdown": 0,
            "safety": 0,
            "field_goal_result": None,
            "td_team": None,
            "interception": 0,
            "fumble_lost": 0,
            "ep": 1.0,
            "epa": 0.1,
        }
    )
    # Play 2: turnover (INT)
    rows.append(
        {
            **rows[0],
            "play_id": 20,
            "down": 2,
            "ydstogo": 10,
            "yardline_100": 75,
            "half_seconds_remaining": 1700,
            "interception": 1,
        }
    )
    # Play 3: KC FG made
    rows.append(
        {
            **rows[0],
            "play_id": 30,
            "down": 1,
            "ydstogo": 10,
            "yardline_100": 30,
            "half_seconds_remaining": 1600,
            "posteam": "KC",
            "defteam": "DET",
            "field_goal_result": "made",
            "interception": 0,
        }
    )
    # Play 4: after score kickoff-like no down then end — use another DET snap then half ends
    rows.append(
        {
            **rows[0],
            "play_id": 40,
            "down": 1,
            "ydstogo": 10,
            "yardline_100": 75,
            "half_seconds_remaining": 100,
            "posteam": "DET",
            "defteam": "KC",
            "field_goal_result": None,
        }
    )
    return pd.DataFrame(rows)


def test_label_opponent_fg_after_turnover():
    df = _mini_game()
    labels = construct_next_score_labels(df)
    # First DET play should see KC FG → OppFieldGoal
    assert labels.iloc[0] == "OppFieldGoal"
    # INT play still before FG → OppFieldGoal
    assert labels.iloc[1] == "OppFieldGoal"
    # KC FG play itself is a made FG for KC → FieldGoal
    assert labels.iloc[2] == "FieldGoal"
    # Last DET play: no further score in half → NoScore
    assert labels.iloc[3] == "NoScore"


def test_eligible_mask_reg_scrimmage():
    df = _mini_game()
    labels = construct_next_score_labels(df)
    mask = eligible_mask(df, labels)
    assert mask.all()


def test_leakage_guard_rejects_ep_feature():
    with pytest.raises(ValueError, match="Leakage"):
        assert_no_leakage_columns(["down", "ep", "yardline_100"])
    with pytest.raises(ValueError, match="Leakage"):
        assert_no_leakage_columns(["reference_epa"])
    with pytest.raises(ValueError, match="Leakage"):
        assert_no_leakage_columns(["vegas_wp"])
    assert_no_leakage_columns(["down", "distance", "yardline_100", "era_post_2020"])


def test_forbidden_exact_covers_reference_outputs():
    for name in ("ep", "epa", "wp", "wpa", "vegas_wp", "spread_line"):
        assert name in FORBIDDEN_EXACT


def test_epa_same_possession():
    r = compute_epa(1.0, ep_after_raw=1.5, possession_change=False, is_timeout=False, is_terminal=False)
    assert r.case == "same_possession"
    assert r.model_epa == pytest.approx(0.5)


def test_epa_possession_change():
    r = compute_epa(1.0, ep_after_raw=2.0, possession_change=True, is_timeout=False, is_terminal=False)
    assert r.case == "possession_change"
    assert r.model_epa == pytest.approx(-2.0 - 1.0)


def test_epa_timeout_zero():
    r = compute_epa(3.0, ep_after_raw=3.0, possession_change=False, is_timeout=True, is_terminal=False)
    assert r.model_epa == 0.0
    assert r.case == "timeout"


def test_epa_terminal():
    r = compute_epa(2.5, ep_after_raw=None, possession_change=False, is_timeout=False, is_terminal=True)
    assert r.model_epa == pytest.approx(-2.5)
    assert r.case == "terminal"


def test_epa_vectorized_matches_scalar():
    eb = np.array([1.0, 2.0, 3.0, 1.5])
    ea = np.array([1.2, 0.5, 0.0, 2.0])
    pc = np.array([False, True, False, False])
    to = np.array([False, False, True, False])
    term = np.array([False, False, False, True])
    got = model_epa_from_eps(eb, ea, possession_change=pc, is_timeout=to, is_terminal=term)
    expect = np.array(
        [
            compute_epa(1.0, ep_after_raw=1.2, possession_change=False, is_timeout=False, is_terminal=False).model_epa,
            compute_epa(2.0, ep_after_raw=0.5, possession_change=True, is_timeout=False, is_terminal=False).model_epa,
            compute_epa(3.0, ep_after_raw=0.0, possession_change=False, is_timeout=True, is_terminal=False).model_epa,
            compute_epa(1.5, ep_after_raw=2.0, possession_change=False, is_timeout=False, is_terminal=True).model_epa,
        ]
    )
    np.testing.assert_allclose(got, expect)


def test_split_forbids_2023_in_fit():
    with pytest.raises(ValueError, match="Test-season leakage"):
        forbid_test_season_in_fit([2019, 2023], context="train_fit")


def test_proba_sum_and_ep_bounds_toy_train():
    # Tiny synthetic train with all classes represented
    rng = np.random.default_rng(0)
    rows = []
    for i, cls in enumerate(EP_CLASSES):
        for k in range(30):
            rows.append(
                {
                    "game_id": f"g{i}",
                    "play_id": k,
                    "season": 2019 + (i % 3),
                    "season_type": "REG",
                    "qtr": 1,
                    "down": int(rng.integers(1, 5)),
                    "ydstogo": int(rng.integers(1, 15)),
                    "yardline_100": int(rng.integers(1, 99)),
                    "half_seconds_remaining": int(rng.integers(60, 1800)),
                    "posteam": "A",
                    "defteam": "B",
                    "home_team": "A",
                    "posteam_timeouts_remaining": 3,
                    "defteam_timeouts_remaining": 3,
                    "roof": "outdoors",
                    "play_type": "pass",
                    "ep_label": cls,
                    "ep": 0.0,
                    "epa": 0.0,
                }
            )
    df = pd.DataFrame(rows)
    # seasons only 2019-2021
    df["season"] = 2019
    model = EPModel().fit(df, C=1.0)
    proba = model.predict_proba(df.head(20))
    assert np.allclose(proba.sum(axis=1), 1.0, atol=1e-6)
    ep = expected_points_from_proba(proba, EP_CLASSES)
    assert ep.min() >= -7.0 - 1e-6
    assert ep.max() <= 7.0 + 1e-6
    # Feature frame has no forbidden cols
    feats = build_feature_frame(df)
    assert not any(c in FORBIDDEN_EXACT for c in feats.columns)


def test_constant_baseline_fit_on_train_labels_only():
    y = pd.Series(["Touchdown"] * 3 + ["NoScore"] * 7)
    b = ConstantBaseline().fit(y)
    p = b.predict_proba(5)
    assert p.shape == (5, 7)
    assert np.allclose(p.sum(axis=1), 1.0)
