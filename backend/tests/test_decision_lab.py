"""Historical decision lab: freeze lake rows → reuse FourthDownAnalyzer."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.decision_lab import (
    freeze_play,
    fourth_down_mask,
    historical_action_from_play_type,
    row_to_situation,
    run_decision_lab,
    select_play,
    summarize_lab,
)
from nfl_sim.models.fourth_down import FourthDownAnalyzer
from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics
from nfl_sim.models.wp_model import WPModel


def _toy_wp_model() -> WPModel:
    rng = np.random.default_rng(2)
    rows = []
    for k in range(80):
        sd = int(rng.integers(-14, 15))
        yl = int(rng.integers(10, 90))
        home_win = sd > 0 or (sd == 0 and yl < 50)
        rows.append(
            {
                "game_id": f"g{k}",
                "play_id": k,
                "season": 2019,
                "season_type": "REG",
                "qtr": 4,
                "down": 4,
                "ydstogo": 1 + (k % 5),
                "yardline_100": yl,
                "half_seconds_remaining": 300,
                "game_seconds_remaining": 300,
                "score_differential": sd,
                "posteam": "H",
                "defteam": "A",
                "home_team": "H",
                "away_team": "A",
                "posteam_timeouts_remaining": 2,
                "defteam_timeouts_remaining": 2,
                "home_score": 21 if home_win else 14,
                "away_score": 14 if home_win else 21,
                "wp_label": 1 if home_win else 0,
            }
        )
    return WPModel().fit(pd.DataFrame(rows), C=1.0)


def _toy_empirics() -> FourthDownEmpirics:
    return FourthDownEmpirics(
        convert_by_distance={
            (1, 1): {"n": 100, "p_convert": 0.65, "filter": "toy"},
            (2, 2): {"n": 100, "p_convert": 0.55, "filter": "toy"},
            (3, 3): {"n": 100, "p_convert": 0.45, "filter": "toy"},
            (4, 5): {"n": 100, "p_convert": 0.40, "filter": "toy"},
            (6, 10): {"n": 100, "p_convert": 0.30, "filter": "toy"},
            (11, 99): {"n": 100, "p_convert": 0.20, "filter": "toy"},
        },
        fg_by_kick_distance={
            (18, 29): {"n": 50, "p_make": 0.95, "filter": "toy"},
            (30, 39): {"n": 50, "p_make": 0.90, "filter": "toy"},
            (40, 49): {"n": 50, "p_make": 0.75, "filter": "toy"},
            (50, 59): {"n": 50, "p_make": 0.60, "filter": "toy"},
            (60, 64): {"n": 10, "p_make": 0.30, "filter": "toy"},
        },
        punt_by_yardline={
            (1, 40): {"n": 20, "mean_opp_yardline_100": 88.0, "filter": "toy"},
            (41, 60): {"n": 20, "mean_opp_yardline_100": 85.0, "filter": "toy"},
            (61, 80): {"n": 20, "mean_opp_yardline_100": 74.0, "filter": "toy"},
            (81, 99): {"n": 20, "mean_opp_yardline_100": 56.0, "filter": "toy"},
        },
        meta={"seasons": [2019], "n_go": 0, "n_fg": 0, "n_punt": 0},
    )


def _sample_frame() -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "season": 2022,
                "season_type": "REG",
                "week": 1,
                "game_id": "2022_01_AAA_BBB",
                "play_id": 100.0,
                "qtr": 4,
                "down": 4,
                "ydstogo": 1,
                "yardline_100": 55,
                "score_differential": 0,
                "game_seconds_remaining": 360,
                "half_seconds_remaining": 360,
                "posteam": "AAA",
                "defteam": "BBB",
                "home_team": "BBB",
                "away_team": "AAA",
                "posteam_timeouts_remaining": 2,
                "defteam_timeouts_remaining": 2,
                "play_type": "punt",
                "desc": "toy punt",
                "receive_2h_ko": 0,
            },
            {
                "season": 2022,
                "season_type": "REG",
                "week": 1,
                "game_id": "2022_01_AAA_BBB",
                "play_id": 250.0,
                "qtr": 4,
                "down": 4,
                "ydstogo": 3,
                "yardline_100": 33,
                "score_differential": -3,
                "game_seconds_remaining": 120,
                "half_seconds_remaining": 120,
                "posteam": "BBB",
                "defteam": "AAA",
                "home_team": "BBB",
                "away_team": "AAA",
                "posteam_timeouts_remaining": 1,
                "defteam_timeouts_remaining": 2,
                "play_type": "pass",
                "desc": "toy go",
                "receive_2h_ko": 0,
            },
            {
                "season": 2022,
                "season_type": "REG",
                "week": 1,
                "game_id": "2022_01_CCC_DDD",
                "play_id": 10.0,
                "qtr": 2,
                "down": 3,  # not 4th
                "ydstogo": 5,
                "yardline_100": 40,
                "score_differential": 7,
                "game_seconds_remaining": 500,
                "half_seconds_remaining": 500,
                "posteam": "CCC",
                "defteam": "DDD",
                "home_team": "DDD",
                "away_team": "CCC",
                "posteam_timeouts_remaining": 3,
                "defteam_timeouts_remaining": 3,
                "play_type": "pass",
                "desc": "not fourth",
                "receive_2h_ko": 1,
            },
        ]
    )


def test_historical_action_mapping():
    assert historical_action_from_play_type("pass") == "go"
    assert historical_action_from_play_type("run") == "go"
    assert historical_action_from_play_type("field_goal") == "fg"
    assert historical_action_from_play_type("punt") == "punt"
    assert historical_action_from_play_type("no_play") is None


def test_fourth_down_mask_and_select():
    df = _sample_frame()
    masked = df.loc[fourth_down_mask(df)].reset_index(drop=True)
    assert len(masked) == 2
    row = select_play(masked, game_id="2022_01_AAA_BBB", play_id=250)
    assert int(row["ydstogo"]) == 3
    row0 = select_play(masked, index=0)
    assert int(row0["play_id"]) == 100
    with pytest.raises(KeyError):
        select_play(masked, game_id="missing", play_id=1)


def test_row_to_situation_and_freeze_provenance():
    df = _sample_frame()
    row = df.iloc[1]
    sit = row_to_situation(row)
    assert sit.yardline_100 == 33
    assert sit.distance == 3
    assert sit.score_differential == -3
    assert sit.is_home_possession is True
    play = freeze_play(row)
    assert play.provenance["game_id"] == "2022_01_AAA_BBB"
    assert play.provenance["play_id"] == 250.0
    assert play.historical_action == "go"
    assert play.game_state["distance"] == 3


def test_run_decision_lab_reuses_analyzer():
    df = _sample_frame()
    az = FourthDownAnalyzer(_toy_wp_model(), _toy_empirics())
    result = run_decision_lab(az, df.iloc[0], convert_delta=-0.35, make_delta=0.0)
    kd = result.analysis.situation["kick_distance"]
    expected = {"go", "fg", "punt"} if kd <= 64 else {"go", "punt"}
    assert set(result.analysis.actions) == expected
    assert result.play.provenance["game_id"] == "2022_01_AAA_BBB"
    assert result.sensitivity is not None
    assert "recommendation_changed" in result.sensitivity
    summary = summarize_lab(result)
    assert summary["historical_action"] == "punt"
    assert summary["recommendation"] in {"go", "fg", "punt", "inconclusive"}
    d = result.to_dict()
    assert d["truth_labels"]["play"] == "historical"
    assert d["truth_labels"]["action_values"] == "model_counterfactual"
