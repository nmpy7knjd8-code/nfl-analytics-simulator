"""Variance-aware punt buckets + outcome-dependent clock on decision-lab harness."""

from __future__ import annotations

import numpy as np
import pandas as pd

from nfl_sim.models.decision_lab import compare_transition_modes, run_decision_lab
from nfl_sim.models.fourth_down import FourthDownAnalyzer, FourthDownSituation, state_go_convert
from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics
from nfl_sim.models.wp_model import WPModel


def _toy_wp() -> WPModel:
    rng = np.random.default_rng(7)
    rows = []
    for k in range(80):
        sd = int(rng.integers(-14, 15))
        yl = int(rng.integers(10, 90))
        gsec = int(rng.choice([90, 120, 300, 600]))
        win = 1 if sd > 0 or (sd == 0 and yl < 50) else 0
        rows.append(
            {
                "game_id": f"g{k}",
                "play_id": k,
                "season": 2019,
                "season_type": "REG",
                "qtr": 4,
                "down": 4,
                "ydstogo": 1,
                "yardline_100": yl,
                "half_seconds_remaining": gsec,
                "game_seconds_remaining": gsec,
                "score_differential": sd,
                "posteam": "H",
                "defteam": "A",
                "home_team": "H",
                "away_team": "A",
                "posteam_timeouts_remaining": 2,
                "defteam_timeouts_remaining": 2,
                "home_score": 21 if win else 14,
                "away_score": 14 if win else 21,
                "wp_label": win,
            }
        )
    return WPModel().fit(pd.DataFrame(rows), C=1.0)


def _emp_with_buckets_and_clock() -> FourthDownEmpirics:
    convert = {
        (1, 1): {"n": 100, "p_convert": 0.55, "filter": "toy"},
        (2, 2): {"n": 100, "p_convert": 0.45, "filter": "toy"},
        (3, 3): {"n": 100, "p_convert": 0.40, "filter": "toy"},
        (4, 5): {"n": 100, "p_convert": 0.35, "filter": "toy"},
        (6, 10): {"n": 100, "p_convert": 0.25, "filter": "toy"},
        (11, 99): {"n": 100, "p_convert": 0.15, "filter": "toy"},
    }
    fg = {
        (18, 29): {"n": 50, "p_make": 0.95, "filter": "toy"},
        (30, 39): {"n": 50, "p_make": 0.90, "filter": "toy"},
        (40, 49): {"n": 50, "p_make": 0.75, "filter": "toy"},
        (50, 59): {"n": 50, "p_make": 0.60, "filter": "toy"},
        (60, 64): {"n": 10, "p_make": 0.30, "filter": "toy"},
    }
    punt = {
        (1, 40): {
            "n": 20,
            "mean_opp_yardline_100": 88.0,
            "tb_rate": 0.1,
            "buckets": [
                {"label": "q25", "opp_yardline_100": 80.0, "weight": 0.25},
                {"label": "q50", "opp_yardline_100": 88.0, "weight": 0.50},
                {"label": "q75", "opp_yardline_100": 95.0, "weight": 0.25},
            ],
            "filter": "toy",
        },
        (41, 60): {
            "n": 20,
            "mean_opp_yardline_100": 85.0,
            "tb_rate": 0.13,
            "buckets": [
                {"label": "q25", "opp_yardline_100": 78.0, "weight": 0.25},
                {"label": "q50", "opp_yardline_100": 86.0, "weight": 0.50},
                {"label": "q75", "opp_yardline_100": 93.0, "weight": 0.25},
            ],
            "filter": "toy",
        },
        (61, 80): {
            "n": 20,
            "mean_opp_yardline_100": 74.0,
            "tb_rate": 0.2,
            "buckets": [
                {"label": "q25", "opp_yardline_100": 65.0, "weight": 0.25},
                {"label": "q50", "opp_yardline_100": 74.0, "weight": 0.50},
                {"label": "q75", "opp_yardline_100": 82.0, "weight": 0.25},
            ],
            "filter": "toy",
        },
        (81, 99): {
            "n": 20,
            "mean_opp_yardline_100": 56.0,
            "tb_rate": 0.3,
            "buckets": [
                {"label": "q25", "opp_yardline_100": 45.0, "weight": 0.25},
                {"label": "q50", "opp_yardline_100": 56.0, "weight": 0.50},
                {"label": "q75", "opp_yardline_100": 70.0, "weight": 0.25},
            ],
            "filter": "toy",
        },
    }
    clock = {
        "method": "toy",
        "go_convert": {"n": 10, "median": 29.0, "mean": 29.0, "p25": 20.0, "p75": 35.0},
        "go_fail": {"n": 10, "median": 5.0, "mean": 5.0, "p25": 4.0, "p75": 6.0},
        "fg_make": {"n": 10, "median": 4.0, "mean": 4.0, "p25": 4.0, "p75": 5.0},
        "fg_miss": {"n": 10, "median": 5.0, "mean": 5.0, "p25": 4.0, "p75": 6.0},
        "punt": {"n": 10, "median": 9.0, "mean": 9.0, "p25": 7.0, "p75": 11.0},
        "legacy_toy_seconds": 6,
    }
    return FourthDownEmpirics(
        convert_by_distance=convert,
        fg_by_kick_distance=fg,
        punt_by_yardline=punt,
        clock_by_outcome=clock,
        meta={"seasons": [2019, 2020, 2021], "n_go": 1, "n_fg": 1, "n_punt": 1},
    )


def test_outcome_clock_deltas_differ():
    emp = _emp_with_buckets_and_clock()
    assert emp.clock_delta("go_convert", transition_mode="improved") == 29
    assert emp.clock_delta("go_fail", transition_mode="improved") == 5
    assert emp.clock_delta("punt", transition_mode="improved") == 9
    assert emp.clock_delta("go_convert", transition_mode="legacy") == 6


def test_state_go_convert_uses_clock_delta():
    sit = FourthDownSituation(55, 1, 0, 100, 100, qtr=4)
    legacy = state_go_convert(sit, clock_delta=6)
    improved = state_go_convert(sit, clock_delta=29)
    assert legacy["game_seconds_remaining"] == 94
    assert improved["game_seconds_remaining"] == 71


def test_improved_punt_uses_bucket_expectation():
    az = FourthDownAnalyzer(_toy_wp(), _emp_with_buckets_and_clock())
    sit = FourthDownSituation(55, 1, 0, 360, 360, qtr=4, season=2022)
    legacy = az.analyze(sit, transition_mode="legacy")
    improved = az.analyze(sit, transition_mode="improved")
    assert legacy.actions["punt"].components["method"].startswith("mean")
    assert "buckets" in improved.actions["punt"].components
    assert len(improved.actions["punt"].components["buckets"]) == 3
    # Clock deltas recorded
    assert improved.empirics_meta["clock_deltas_used"]["go_convert"] == 29
    assert legacy.empirics_meta["clock_deltas_used"]["go_convert"] == 6


def test_compare_transition_modes_on_row():
    az = FourthDownAnalyzer(_toy_wp(), _emp_with_buckets_and_clock())
    row = {
        "season": 2022,
        "season_type": "REG",
        "week": 1,
        "game_id": "2022_01_BAL_NYJ",
        "play_id": 368.0,
        "qtr": 1,
        "down": 4,
        "ydstogo": 1,
        "yardline_100": 51,
        "score_differential": 0,
        "game_seconds_remaining": 3296,
        "half_seconds_remaining": 1496,
        "posteam": "BAL",
        "defteam": "NYJ",
        "home_team": "NYJ",
        "away_team": "BAL",
        "posteam_timeouts_remaining": 3,
        "defteam_timeouts_remaining": 3,
        "play_type": "punt",
        "receive_2h_ko": 0,
    }
    cmp = compare_transition_modes(az, row)
    assert "pooled_legacy" in cmp and "pooled_improved" in cmp and "season_aware_legacy" in cmp
    assert "value_deltas_legacy_to_improved" in cmp
    lab = run_decision_lab(az, row, transition_mode="improved", include_sensitivity=False)
    assert lab.analysis.empirics_meta["transition_mode"] == "improved"
