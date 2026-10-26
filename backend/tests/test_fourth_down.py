"""Fourth-down analytical prototype: states, empirics gate, decision edges."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.fourth_down import (
    FourthDownSituation,
    kick_distance,
    state_fg_make,
    state_fg_miss,
    state_go_convert,
    state_go_fail,
    state_punt,
)
from nfl_sim.models.fourth_down_empirics import FourthDownEmpirics
from nfl_sim.models.split import forbid_test_season_in_fit
from nfl_sim.models.wp_model import WPModel


def _toy_wp_model() -> WPModel:
    """Tiny WP model: prefers leading + more field position."""
    rng = np.random.default_rng(1)
    rows = []
    for k in range(120):
        sd = int(rng.integers(-14, 15))
        yl = int(rng.integers(10, 90))
        home_win = sd > 0 or (sd == 0 and yl < 50)
        # label from final scores proxy
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
    df = pd.DataFrame(rows)
    return WPModel().fit(df, C=1.0)


def test_kick_distance_formula():
    sit = FourthDownSituation(
        yardline_100=33, distance=3, score_differential=0, game_seconds_remaining=120, half_seconds_remaining=120
    )
    assert kick_distance(sit) == 50


def test_go_convert_and_fail_states():
    sit = FourthDownSituation(
        yardline_100=40,
        distance=2,
        score_differential=3,
        game_seconds_remaining=200,
        half_seconds_remaining=200,
        is_home_possession=True,
    )
    ok = state_go_convert(sit)
    assert ok["down"] == 1
    assert ok["yardline_100"] == 38
    assert ok["posteam"] == "H"
    fail = state_go_fail(sit)
    assert fail["posteam"] == "A"
    assert fail["yardline_100"] == 60
    assert fail["score_differential"] == -3


def test_go_convert_td_flips_to_kickoff():
    sit = FourthDownSituation(
        yardline_100=2,
        distance=2,
        score_differential=0,
        game_seconds_remaining=100,
        half_seconds_remaining=100,
    )
    row = state_go_convert(sit)
    assert row["posteam"] == "A"
    assert row["yardline_100"] == 75
    assert row["score_differential"] == -7


def test_fg_make_miss_punt_states():
    sit = FourthDownSituation(
        yardline_100=30,
        distance=8,
        score_differential=-4,
        game_seconds_remaining=400,
        half_seconds_remaining=400,
    )
    make = state_fg_make(sit)
    # old sd=-4; after +3 for kickers, new posteam (opp) sd = -(-4+3) = 1
    assert make["score_differential"] == 1
    assert make["yardline_100"] == 75
    miss = state_fg_miss(sit)
    assert miss["yardline_100"] == 70
    punt = state_punt(sit, 78)
    assert punt["yardline_100"] == 78
    assert punt["posteam"] == "A"


def test_empirics_refuse_2023():
    with pytest.raises(ValueError):
        forbid_test_season_in_fit([2019, 2023], context="train_fit")
    with pytest.raises(ValueError):
        FourthDownEmpirics.fit_from_seasons((2023,))


def test_analyzer_recommendation_and_sensitivity():
    from nfl_sim.models.fourth_down import FourthDownAnalyzer, sensitivity_example

    model = _toy_wp_model()
    # Hand-built empirics (no lake dependency in unit test)
    emp = FourthDownEmpirics(
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
    az = FourthDownAnalyzer(model, emp)
    # Short-yardage midfield late — go often competitive
    sit = FourthDownSituation(
        yardline_100=55,
        distance=1,
        score_differential=0,
        game_seconds_remaining=360,
        half_seconds_remaining=360,
        qtr=4,
    )
    res = az.analyze(sit)
    # yardline 55 → 72-yd kick: beyond MAX_FG_DISTANCE, so FG is not an option.
    assert set(res.actions) == {"go", "punt"}
    assert all(0.0 <= a.value_wp <= 1.0 for a in res.actions.values())
    assert res.recommendation in {"go", "fg", "punt", "inconclusive"}

    # Force sensitivity change by crushing conversion
    sens = sensitivity_example(az, sit, convert_delta=-0.50, make_delta=0.0)
    assert "baseline" in sens and "alternate" in sens
    # With convert≈0, go value should drop toward fail WP
    assert sens["alternate"]["actions"]["go"]["value_wp"] <= sens["baseline"]["actions"]["go"]["value_wp"] + 1e-9


from nfl_sim.models.fourth_down_empirics import CONVERT_BINS, PUNT_YARDLINE_BINS  # noqa: E402


def _toy_empirics():
    return FourthDownEmpirics(
        convert_by_distance={b: {"n": 100, "p_convert": 0.5, "filter": "toy"} for b in CONVERT_BINS},
        fg_by_kick_distance={
            (18, 29): {"n": 50, "p_make": 0.95, "filter": "toy"},
            (30, 39): {"n": 50, "p_make": 0.90, "filter": "toy"},
            (40, 49): {"n": 50, "p_make": 0.75, "filter": "toy"},
            (50, 59): {"n": 50, "p_make": 0.60, "filter": "toy"},
            (60, 64): {"n": 10, "p_make": 0.30, "filter": "toy"},
        },
        punt_by_yardline={b: {"n": 20, "mean_opp_yardline_100": 80.0, "filter": "toy"} for b in PUNT_YARDLINE_BINS},
        meta={"seasons": [2019]},
    )


@pytest.mark.parametrize("kd", [65, 66, 70, 80, 81, 99, 116])
def test_p_make_is_zero_beyond_64_yards(kd):
    p, meta = _toy_empirics().p_make(kd)
    assert p == 0.0 and meta["out_of_range"] is True


@pytest.mark.parametrize("kd,expected", [(18, 0.95), (59, 0.60), (60, 0.30), (64, 0.30)])
def test_p_make_in_range_uses_bins(kd, expected):
    p, meta = _toy_empirics().p_make(kd)
    assert p == expected and not meta.get("out_of_range")


def test_legacy_60_80_table_never_leaks_past_64():
    emp = _toy_empirics()
    emp.fg_by_kick_distance = {**{k: v for k, v in emp.fg_by_kick_distance.items() if k != (60, 64)},
                               (60, 80): {"n": 10, "p_make": 0.30, "filter": "old pickle"}}
    assert emp.p_make(62)[0] == 0.30
    assert emp.p_make(75)[0] == 0.0


def test_bin_rate_refuses_to_clamp_above_last_bin():
    from nfl_sim.models.fourth_down_empirics import FG_BINS, MAX_FG_DISTANCE, _bin_rate

    assert FG_BINS[-1][1] == MAX_FG_DISTANCE == 64
    with pytest.raises(ValueError):
        _bin_rate(FG_BINS, 70, {b: {} for b in FG_BINS})


def test_fg_table_ignores_attempts_beyond_64():
    from nfl_sim.models.fourth_down_empirics import _build_fg_table

    kd = pd.Series([62, 63, 66, 70])
    made = pd.Series([False, False, True, True])
    tbl = _build_fg_table(kd, made)
    assert tbl[(60, 64)]["n"] == 2 and tbl[(60, 64)]["p_make"] == 0.0


@pytest.mark.parametrize("yardline,has_fg", [(30, True), (47, True), (48, False), (60, False)])
def test_analyzer_drops_fg_when_out_of_range(yardline, has_fg):
    from nfl_sim.models.fourth_down import FourthDownAnalyzer, sensitivity_example

    az = FourthDownAnalyzer(_toy_wp_model(), _toy_empirics())
    sit = FourthDownSituation(yardline_100=yardline, distance=3, score_differential=-2,
                              game_seconds_remaining=120, half_seconds_remaining=120, qtr=4)
    res = az.analyze(sit)
    assert ("fg" in res.actions) is has_fg
    assert res.recommendation != "fg" or has_fg
    sensitivity_example(az, sit, convert_delta=-0.1)  # must not KeyError without fg
