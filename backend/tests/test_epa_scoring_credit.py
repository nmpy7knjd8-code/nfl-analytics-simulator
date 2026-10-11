"""Task A: hand-checkable EPA scoring-credit synthetics (intended semantics).

These encode next-score accounting identities — not merely current production bugs.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.epa import attach_post_state, compute_epa
from nfl_sim.models.scoring_credit import (
    convention_a_epa,
    convention_b_epa,
    realized_next_score_value,
    score_conventions_from_ep_surface,
)


def _row(**kw: object) -> dict:
    base = {
        "game_id": "SYN_A",
        "play_id": 1,
        "season": 2022,
        "season_type": "REG",
        "qtr": 1,
        "down": 1,
        "ydstogo": 10,
        "yardline_100": 75,
        "half_seconds_remaining": 1800,
        "posteam": "AA",
        "defteam": "BB",
        "home_team": "AA",
        "away_team": "BB",
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
        "punt_attempt": 0,
        "fourth_down_failed": 0,
        "ep": 1.0,
        "epa": 0.0,
        "posteam_score": 0,
        "defteam_score": 0,
        "posteam_score_post": 0,
        "defteam_score_post": 0,
    }
    base.update(kw)
    return base


def test_realized_r_td_offense_is_plus_7_not_scoreboard_6():
    df = pd.DataFrame(
        [_row(touchdown=1, td_team="AA", posteam_score_post=6, defteam_score_post=0)]
    )
    r = realized_next_score_value(df)
    assert r.iloc[0] == pytest.approx(7.0)


def test_realized_r_defensive_td_is_minus_7():
    df = pd.DataFrame(
        [
            _row(
                touchdown=1,
                td_team="BB",
                interception=1,
                posteam="AA",
                defteam="BB",
                posteam_score_post=0,
                defteam_score_post=6,
            )
        ]
    )
    assert realized_next_score_value(df).iloc[0] == pytest.approx(-7.0)


def test_xp_row_realized_r_is_zero():
    df = pd.DataFrame(
        [
            _row(play_id=10, touchdown=1, td_team="AA"),
            _row(
                play_id=20,
                down=None,
                ydstogo=None,
                play_type="extra_point",
                touchdown=1,
                td_team="AA",
            ),
        ]
    )
    r = realized_next_score_value(df)
    assert r.iloc[0] == pytest.approx(7.0)
    assert r.iloc[1] == pytest.approx(0.0)


def test_convention_a_td_then_kickoff_missing_plus_7():
    """A omits R; B (nflfastR) overrides to R - ep; try/KO are separate rows."""
    eb, ea = 3.0, 0.5
    a = compute_epa(eb, ep_after_raw=ea, possession_change=True, is_timeout=False, is_terminal=False)
    assert a.model_epa == pytest.approx(-ea - eb)  # -3.5
    b = convention_b_epa(
        np.array([eb]),
        np.array([ea]),
        possession_change=np.array([True]),
        is_timeout=np.array([False]),
        is_terminal=np.array([False]),
        realized_r=np.array([7.0]),
    )[0]
    assert b == pytest.approx(7.0 - eb)  # 4.0 — not 7 - ea - eb
    assert b != pytest.approx(a.model_epa)


def test_convention_b_fg_then_kickoff():
    eb, ea = 2.0, 0.8
    b = convention_b_epa(
        np.array([eb]),
        np.array([ea]),
        possession_change=np.array([True]),
        is_timeout=np.array([False]),
        is_terminal=np.array([False]),
        realized_r=np.array([3.0]),
    )[0]
    assert b == pytest.approx(3.0 - eb)


def test_td_end_of_half_epoch_form():
    """Walk-off TD: A terminal -eb; B score overlay R - eb (sp!=0 keeps cash)."""
    eb = 2.5
    a = compute_epa(eb, ep_after_raw=None, possession_change=False, is_timeout=False, is_terminal=True)
    assert a.model_epa == pytest.approx(-eb)
    b = convention_b_epa(
        np.array([eb]),
        np.array([0.0]),
        possession_change=np.array([False]),
        is_timeout=np.array([False]),
        is_terminal=np.array([True]),
        realized_r=np.array([7.0]),
    )[0]
    assert b == pytest.approx(7.0 - eb)


def test_punt_possession_change_no_r():
    eb, ea = 1.2, 1.5
    a = convention_a_epa(
        np.array([eb]),
        np.array([ea]),
        possession_change=np.array([True]),
        is_timeout=np.array([False]),
        is_terminal=np.array([False]),
    )[0]
    b = convention_b_epa(
        np.array([eb]),
        np.array([ea]),
        possession_change=np.array([True]),
        is_timeout=np.array([False]),
        is_terminal=np.array([False]),
        realized_r=np.array([0.0]),
    )[0]
    assert a == pytest.approx(-ea - eb)
    assert b == pytest.approx(a)


def test_turnover_non_score_matches_sign_flip():
    eb, ea = 2.0, 0.9
    b = convention_b_epa(
        np.array([eb]),
        np.array([ea]),
        possession_change=np.array([True]),
        is_timeout=np.array([False]),
        is_terminal=np.array([False]),
        realized_r=np.array([0.0]),
    )[0]
    assert b == pytest.approx(-ea - eb)


def test_safety_credits_minus_2_for_posteam():
    df = pd.DataFrame([_row(safety=1, yardline_100=1, posteam="AA", defteam="BB")])
    assert realized_next_score_value(df).iloc[0] == pytest.approx(-2.0)
    eb, ea = 0.2, 1.0
    b = convention_b_epa(
        np.array([eb]),
        np.array([ea]),
        possession_change=np.array([True]),
        is_timeout=np.array([False]),
        is_terminal=np.array([False]),
        realized_r=np.array([-2.0]),
    )[0]
    assert b == pytest.approx(-2.0 - eb)


def test_half_end_no_score_terminal():
    eb = 1.1
    a = compute_epa(eb, ep_after_raw=None, possession_change=False, is_timeout=False, is_terminal=True)
    assert a.model_epa == pytest.approx(-eb)


def test_chain_identity_b_epoch_td_then_opponent_snap():
    """Σ EPA under B_epoch = R - EP0 for a one-play TD epoch."""
    # Pre-play EP=3, TD, next opponent EP=0.5 (ignored in epoch-close form)
    ep0 = 3.0
    r = 7.0
    epa = r - ep0
    assert epa == pytest.approx(4.0)
    # Multi-play: gain then TD
    # play1 same: ea1=3.5, eb1=3.0 → +0.5; play2 score epoch-close: 7-3.5 → 3.5; sum=4=7-3
    ebs = np.array([3.0, 3.5])
    eas = np.array([3.5, 0.5])
    pcs = np.array([False, True])
    terms = np.array([False, False])
    rs = np.array([0.0, 7.0])
    epa1 = convention_a_epa(ebs[:1], eas[:1], possession_change=pcs[:1], is_timeout=np.array([False]), is_terminal=terms[:1])[0]
    epa2 = rs[1] - ebs[1]  # epoch close
    assert epa1 + epa2 == pytest.approx(rs[1] - ebs[0])


def test_attach_post_state_td_links_to_next_scrimmage_not_xp():
    df = pd.DataFrame(
        [
            _row(play_id=10, touchdown=1, td_team="AA", ep=3.0),
            _row(play_id=20, down=None, play_type="extra_point", ep=np.nan),
            _row(play_id=30, down=None, play_type="kickoff", ep=np.nan),
            _row(play_id=40, posteam="BB", defteam="AA", yardline_100=75, ep=0.6),
        ]
    )
    out = attach_post_state(df)
    assert bool(out.loc[0, "epa_is_terminal"]) is False
    assert bool(out.loc[0, "epa_possession_change"]) is True
    assert out.loc[0, "epa_next_posteam"] == "BB"


def test_forbid_holdout_in_score_conventions():
    df = pd.DataFrame([_row(season=2023, ep=1.0, epa=0.0)])
    with pytest.raises(ValueError, match="2023"):
        score_conventions_from_ep_surface(df, ep_col="ep")
