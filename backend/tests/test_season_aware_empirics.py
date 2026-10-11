"""Season-aware fourth-down empirics on the decision-lab harness."""

from __future__ import annotations

import numpy as np
import pandas as pd

from nfl_sim.models.decision_lab import compare_empirics_modes, freeze_play, run_decision_lab
from nfl_sim.models.fourth_down import FourthDownAnalyzer, FourthDownSituation
from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics
from nfl_sim.models.wp_model import WPModel


def _toy_wp() -> WPModel:
    rng = np.random.default_rng(3)
    rows = []
    for k in range(60):
        sd = int(rng.integers(-10, 11))
        yl = int(rng.integers(20, 80))
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
                "half_seconds_remaining": 300,
                "game_seconds_remaining": 300,
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


def _hand_empirics() -> FourthDownEmpirics:
    """Pooled mid convert; 2021 season table higher convert — season_aware should differ."""
    bins_convert = {
        (1, 1): {"n": 100, "p_convert": 0.55, "filter": "toy"},
        (2, 2): {"n": 100, "p_convert": 0.45, "filter": "toy"},
        (3, 3): {"n": 100, "p_convert": 0.40, "filter": "toy"},
        (4, 5): {"n": 100, "p_convert": 0.35, "filter": "toy"},
        (6, 10): {"n": 100, "p_convert": 0.25, "filter": "toy"},
        (11, 99): {"n": 100, "p_convert": 0.15, "filter": "toy"},
    }
    bins_fg = {
        (18, 29): {"n": 50, "p_make": 0.95, "filter": "toy"},
        (30, 39): {"n": 50, "p_make": 0.90, "filter": "toy"},
        (40, 49): {"n": 50, "p_make": 0.75, "filter": "toy"},
        (50, 59): {"n": 50, "p_make": 0.60, "filter": "toy"},
        (60, 80): {"n": 10, "p_make": 0.30, "filter": "toy"},
    }
    bins_punt = {
        (1, 40): {"n": 20, "mean_opp_yardline_100": 88.0, "filter": "toy"},
        (41, 60): {"n": 20, "mean_opp_yardline_100": 85.0, "filter": "toy"},
        (61, 80): {"n": 20, "mean_opp_yardline_100": 74.0, "filter": "toy"},
        (81, 99): {"n": 20, "mean_opp_yardline_100": 56.0, "filter": "toy"},
    }
    convert_2021 = {k: {**v, "p_convert": min(0.95, v["p_convert"] + 0.20)} for k, v in bins_convert.items()}
    return FourthDownEmpirics(
        convert_by_distance=bins_convert,
        fg_by_kick_distance=bins_fg,
        punt_by_yardline=bins_punt,
        convert_by_season={
            2019: bins_convert,
            2020: bins_convert,
            2021: convert_2021,
        },
        fg_by_season={2019: bins_fg, 2020: bins_fg, 2021: bins_fg},
        punt_by_season={2019: bins_punt, 2020: bins_punt, 2021: bins_punt},
        meta={"seasons": [2019, 2020, 2021], "n_go": 1, "n_fg": 1, "n_punt": 1},
    )


def test_resolve_season_aware_uses_recent_train_for_2022():
    emp = _hand_empirics()
    resolved = emp.resolve_table_season(2022, mode="season_aware")
    assert resolved["table_season"] == 2021
    assert resolved["mode"] == "season_aware"
    p_pool, _ = emp.p_convert(1, season=2022, mode="pooled")
    p_sa, meta = emp.p_convert(1, season=2022, mode="season_aware")
    assert p_sa > p_pool
    assert meta["empirics_resolve"]["table_season"] == 2021


def test_analyze_mode_changes_go_value():
    az = FourthDownAnalyzer(_toy_wp(), _hand_empirics())
    sit = FourthDownSituation(
        yardline_100=51,
        distance=1,
        score_differential=0,
        game_seconds_remaining=3296,
        half_seconds_remaining=1496,
        qtr=1,
        season=2022,
    )
    pooled = az.analyze(sit, empirics_mode="pooled")
    season_aware = az.analyze(sit, empirics_mode="season_aware")
    assert season_aware.actions["go"].components["p_convert"] > pooled.actions["go"].components["p_convert"]
    assert season_aware.empirics_meta["empirics_resolve"]["table_season"] == 2021


def test_compare_empirics_modes_on_frozen_row():
    az = FourthDownAnalyzer(_toy_wp(), _hand_empirics())
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
    play = freeze_play(row)
    assert play.provenance["game_id"] == "2022_01_BAL_NYJ"
    cmp = compare_empirics_modes(az, row)
    assert "pooled" in cmp and "season_aware" in cmp
    assert "value_deltas" in cmp
    assert cmp["season_aware"]["summary"]["p_convert"] > cmp["pooled"]["summary"]["p_convert"]
    # Same freeze path; modes must not silently identical when tables differ.
    assert abs(cmp["value_deltas"]["go"]) > 1e-9
    lab = run_decision_lab(az, row, empirics_mode="season_aware", include_sensitivity=False)
    assert lab.analysis.empirics_meta["empirics_mode"] == "season_aware"
