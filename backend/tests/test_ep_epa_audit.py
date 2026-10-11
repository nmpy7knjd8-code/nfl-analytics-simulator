"""Independent audit regressions: labels, EPA half-boundary, identity, API safety."""

from __future__ import annotations

import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

import importlib

ep_api = importlib.import_module("nfl_sim.api.app")
from nfl_sim.api.app import EpScoreRequest, _load_ep_model, create_app
from nfl_sim.models.constants import EP_CLASS_VALUES, EP_CLASSES
from nfl_sim.models.epa import attach_post_state, compute_epa, model_epa_from_eps
from nfl_sim.models.ep_model import EPModel, expected_points_from_proba
from nfl_sim.models.features import FeatureBuilder, build_feature_frame
from nfl_sim.models.labels import construct_next_score_labels, scoring_event_team


def _base_row(**overrides: object) -> dict:
    row = {
        "game_id": "2022_01_AA_BB",
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
        "home_score": 0,
        "away_score": 0,
        "posteam_score": 0,
        "defteam_score": 0,
        "posteam_score_post": 0,
        "defteam_score_post": 0,
    }
    row.update(overrides)
    return row


def test_defensive_td_uses_td_team_not_posteam():
    """Score attribution must follow td_team / score delta, not posteam alone."""
    df = pd.DataFrame(
        [
            _base_row(
                play_id=10,
                posteam="AA",
                defteam="BB",
                interception=1,
                touchdown=1,
                td_team="BB",
                posteam_score=7,
                defteam_score=0,
                posteam_score_post=7,
                defteam_score_post=6,  # defensive score for BB (defteam)
                home_score=7,
                away_score=6,
            )
        ]
    )
    scorers = scoring_event_team(df)
    assert scorers.iloc[0] == "BB"
    labels = construct_next_score_labels(df)
    assert labels.iloc[0] == "OppTouchdown"


def test_label_sign_matches_home_away_score_delta():
    """Home FG: home_score rises by 3; label from away possession is OppFieldGoal."""
    df = pd.DataFrame(
        [
            _base_row(
                play_id=10,
                posteam="BB",
                defteam="AA",
                home_team="AA",
                away_team="BB",
                yardline_100=40,
            ),
            _base_row(
                play_id=20,
                posteam="AA",
                defteam="BB",
                home_team="AA",
                field_goal_result="made",
                yardline_100=25,
                home_score=0,
                away_score=0,
                posteam_score_post=3,
                defteam_score_post=0,
                home_score_post=3,
                away_score_post=0,
            ),
        ]
    )
    # Explicit score-delta check on scoring row
    assert int(df.loc[1, "posteam_score_post"]) - 0 == 3
    labels = construct_next_score_labels(df)
    assert labels.iloc[0] == "OppFieldGoal"
    assert labels.iloc[1] == "FieldGoal"


def test_extra_point_row_is_not_a_next_score_event():
    """PAT after TD must not create a second scoring event (spec §3.1)."""
    df = pd.DataFrame(
        [
            _base_row(play_id=10, touchdown=1, td_team="AA", posteam="AA"),
            _base_row(
                play_id=20,
                down=None,
                ydstogo=None,
                play_type="extra_point",
                touchdown=1,  # adversarial / dirty flag
                td_team="AA",
                posteam="AA",
            ),
            _base_row(play_id=30, posteam="BB", defteam="AA", yardline_100=75),
        ]
    )
    scorers = scoring_event_team(df)
    assert scorers.iloc[0] == "AA"
    assert pd.isna(scorers.iloc[1])
    labels = construct_next_score_labels(df)
    # After XP, next score in half is still the prior TD from BB's perspective → OppTouchdown
    # Play 30 is after TD+XP with no further score → NoScore
    assert labels.iloc[2] == "NoScore"
    assert labels.iloc[0] == "Touchdown"


def test_safety_credits_defteam():
    df = pd.DataFrame(
        [
            _base_row(play_id=10, posteam="AA", defteam="BB", safety=1, yardline_100=1),
        ]
    )
    assert scoring_event_team(df).iloc[0] == "BB"
    assert construct_next_score_labels(df).iloc[0] == "OppSafety"


def test_epa_end_of_half_is_terminal_not_cross_half_possession_change():
    """Demonstrated bug: Q2→Q3 next snap was treated as possession_change."""
    df = pd.DataFrame(
        [
            _base_row(play_id=10, qtr=2, half_seconds_remaining=5, posteam="AA", defteam="BB"),
            _base_row(
                play_id=20,
                qtr=3,
                half_seconds_remaining=1800,
                posteam="BB",
                defteam="AA",
                yardline_100=75,
            ),
        ]
    )
    out = attach_post_state(df)
    assert bool(out.loc[0, "epa_is_terminal"]) is True
    assert bool(out.loc[0, "epa_possession_change"]) is False
    r = compute_epa(
        2.0,
        ep_after_raw=None,
        possession_change=False,
        is_timeout=False,
        is_terminal=True,
    )
    assert r.model_epa == pytest.approx(-2.0)


def test_epa_same_half_next_scrimmage_still_links():
    df = pd.DataFrame(
        [
            _base_row(play_id=10, qtr=1, posteam="AA", yardline_100=75),
            _base_row(play_id=20, qtr=1, posteam="AA", yardline_100=70, half_seconds_remaining=1700),
        ]
    )
    out = attach_post_state(df)
    assert bool(out.loc[0, "epa_is_terminal"]) is False
    assert bool(out.loc[0, "epa_possession_change"]) is False
    assert out.loc[0, "epa_next_posteam"] == "AA"


def test_accounting_identity_same_possession_chain():
    """Derive: for contiguous same-possession non-timeout plays, Σ EPA = ep_after_last − ep_before_first."""
    ep_before = np.array([1.0, 1.5, 2.0])
    ep_after = np.array([1.5, 2.0, 2.4])
    pc = np.array([False, False, False])
    to = np.array([False, False, False])
    term = np.array([False, False, False])
    epa = model_epa_from_eps(ep_before, ep_after, possession_change=pc, is_timeout=to, is_terminal=term)
    assert epa.sum() == pytest.approx(ep_after[-1] - ep_before[0])


def test_accounting_identity_terminal_half():
    """At half end: EPA_terminal = −ep_before; Σ along same-poss chain to terminal = −ep_before_first."""
    ep_before = np.array([1.0, 0.5])
    ep_after = np.array([0.5, 0.0])
    pc = np.array([False, False])
    to = np.array([False, False])
    term = np.array([False, True])
    epa = model_epa_from_eps(ep_before, ep_after, possession_change=pc, is_timeout=to, is_terminal=term)
    assert epa[1] == pytest.approx(-0.5)
    assert epa.sum() == pytest.approx(-ep_before[0])


def test_accounting_identity_possession_change_sign_flip():
    """Possession change: EPA = -ep_after_raw - ep_before (not ep_after - ep_before)."""
    ep_before = np.array([2.0, 1.0])
    ep_after = np.array([1.5, 0.8])
    pc = np.array([True, False])
    to = np.array([False, False])
    term = np.array([False, False])
    epa = model_epa_from_eps(ep_before, ep_after, possession_change=pc, is_timeout=to, is_terminal=term)
    assert epa[0] == pytest.approx(-1.5 - 2.0)
    assert epa[1] == pytest.approx(0.8 - 1.0)


def test_xp_and_two_point_not_independent_next_score_labels():
    """XP and 2PT tries are not next-score classes; TD already closed the epoch at +7."""
    df = pd.DataFrame(
        [
            _base_row(play_id=10, touchdown=1, td_team="AA", posteam="AA"),
            _base_row(
                play_id=20,
                down=None,
                play_type="two_point_attempt",
                touchdown=1,
                td_team="AA",
                posteam="AA",
            ),
            _base_row(play_id=30, posteam="BB", defteam="AA", yardline_100=75, qtr=1),
        ]
    )
    scorers = scoring_event_team(df)
    assert scorers.iloc[0] == "AA"
    assert pd.isna(scorers.iloc[1])
    labels = construct_next_score_labels(df)
    assert labels.iloc[0] == "Touchdown"
    assert labels.iloc[2] == "NoScore"


def test_realized_points_identity_holds_under_convention_b_score_overlay():
    """D015 Convention B: scoring overlay cashes R, so EPA = R − EP0 on the score play."""
    # Synthetic: ep_before=2, TD (+7), next snap opponent ep_after_raw=1.0
    # Without R: PC would give -3; with realized_r=7: EPA = 5.
    r = compute_epa(
        2.0,
        ep_after_raw=1.0,
        possession_change=True,
        is_timeout=False,
        is_terminal=False,
        realized_r=7.0,
    )
    assert r.case == "scoring"
    assert r.model_epa == pytest.approx(7.0 - 2.0)
    residual = r.model_epa - (7.0 - 2.0)
    assert abs(residual) < 1e-9


def test_legacy_convention_a_omits_score_cash_without_realized_r():
    """Diagnostic Convention A path: omit realized_r → PC/terminal formulas (no overlay)."""
    r = compute_epa(2.0, ep_after_raw=1.0, possession_change=True, is_timeout=False, is_terminal=False)
    assert r.case == "possession_change"
    assert r.model_epa == pytest.approx(-1.0 - 2.0)


def test_accounting_identity_on_training_season_sample():
    """Hand-checkable historical intervals from train seasons only (skip if lake missing)."""
    from nfl_sim.models.dataset import raw_season_path
    from nfl_sim.models.reconcile import accounting_identity_on_intervals
    from nfl_sim.models.epa import score_model_epa

    if not raw_season_path(2019).exists():
        pytest.skip("lake not present")
    # Tiny synthetic-like chain built from real EP model fitted on toy rows
    rows = []
    for i, cls in enumerate(EP_CLASSES):
        for k in range(20):
            rows.append({**_base_row(play_id=i * 100 + k, season=2019, game_id="2019_01_AA_BB"), "ep_label": cls})
    model = EPModel().fit(pd.DataFrame(rows), C=1.0)
    hist = pd.DataFrame(
        [
            _base_row(play_id=10, season=2019, game_id="2019_01_AA_BB", posteam="AA", yardline_100=75),
            _base_row(play_id=20, season=2019, game_id="2019_01_AA_BB", posteam="AA", yardline_100=70, half_seconds_remaining=1700),
            _base_row(play_id=30, season=2019, game_id="2019_01_AA_BB", posteam="AA", yardline_100=65, half_seconds_remaining=1600),
            _base_row(play_id=40, season=2019, game_id="2019_01_AA_BB", qtr=2, half_seconds_remaining=1, posteam="AA", yardline_100=60),
        ]
    )
    scored = score_model_epa(model, hist)
    result = accounting_identity_on_intervals(scored, max_games=5)
    assert result["pass"] is True
    assert result["same_possession_telescoping"]["fail"] == 0
    assert result["terminal_telescoping"]["fail"] == 0


def test_era_unseen_season_encoding_excluded_from_production():
    """era encoding preserved for ablation; production FeatureBuilder must not fit it."""
    from nfl_sim.models.constants import NUMERIC_FEATURES

    df = pd.DataFrame(
        [
            _base_row(season=2019),
            _base_row(season=2021),
            _base_row(season=2025),
        ]
    )
    feats = build_feature_frame(df)
    assert "season" not in feats.columns
    assert list(feats["era_post_2020"]) == [0.0, 1.0, 1.0]
    assert "era_post_2020" not in NUMERIC_FEATURES
    fb = FeatureBuilder().fit(feats)
    assert not any("era_post_2020" in n for n in fb.feature_names)


def test_feature_builder_handles_unseen_roof():
    train = pd.DataFrame([_base_row(roof="outdoors") for _ in range(40)] + [_base_row(roof="dome") for _ in range(40)])
    train["ep_label"] = (["Touchdown"] * 20 + ["NoScore"] * 20 + ["FieldGoal"] * 20 + ["OppTouchdown"] * 20)
    # Fit via FeatureBuilder only
    Xtr = build_feature_frame(train)
    fb = FeatureBuilder().fit(Xtr)
    Xte = build_feature_frame(pd.DataFrame([_base_row(roof="retractable")]))  # → other
    arr = fb.transform(Xte)
    assert arr.shape[0] == 1
    assert np.isfinite(arr).all()


def _valid_score_body(**overrides: object) -> dict:
    body = {
        "down": 1,
        "distance": 10,
        "yardline_100": 75,
        "half_seconds_remaining": 1800,
        "posteam_timeouts": 3,
        "defteam_timeouts": 3,
        "is_home_possession": True,
        "season": 2022,
        "roof": "outdoors",
    }
    body.update(overrides)
    return body


def test_ep_score_request_rejects_missing_fields():
    with pytest.raises(Exception):
        EpScoreRequest.model_validate({"down": 1})


def test_api_rejects_model_path_and_empty_body(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Caller-supplied model_path must be ignored; empty body must 422."""
    _load_ep_model.cache_clear()
    # Tiny fit artifact
    rows = []
    for i, cls in enumerate(EP_CLASSES):
        for k in range(25):
            rows.append(
                {
                    **_base_row(play_id=i * 100 + k, season=2019),
                    "ep_label": cls,
                }
            )
    df = pd.DataFrame(rows)
    model = EPModel().fit(df, C=1.0)
    art = tmp_path / "ep_model.joblib"
    model.save(art)
    monkeypatch.setattr(ep_api, "EP_MODEL_ARTIFACT", art)
    _load_ep_model.cache_clear()

    client = TestClient(create_app())
    # Empty / partial body → validation error
    r = client.post("/models/ep/score", json={})
    assert r.status_code == 422

    # model_path is forbidden extra — must 422, never load attacker path
    attacker = tmp_path / "evil.joblib"
    attacker.write_bytes(b"not-a-model")
    r2 = client.post(
        "/models/ep/score",
        json=_valid_score_body(model_path=str(attacker)),
    )
    assert r2.status_code == 422

    # Malformed ranges
    r3 = client.post("/models/ep/score", json=_valid_score_body(down=0))
    assert r3.status_code == 422
    r4 = client.post("/models/ep/score", json=_valid_score_body(yardline_100=150))
    assert r4.status_code == 422

    # Happy path
    r5 = client.post("/models/ep/score", json=_valid_score_body())
    assert r5.status_code == 200
    body = r5.json()
    assert -7.0 <= body["model_ep"] <= 7.0
    assert abs(sum(body["proba"].values()) - 1.0) < 1e-5
    assert body["model_meta"]["artifact_sha256"] == hashlib.sha256(art.read_bytes()).hexdigest()
    _load_ep_model.cache_clear()


def test_ep_bounds_from_proba():
    p = np.zeros((1, 7))
    p[0, list(EP_CLASSES).index("Touchdown")] = 1.0
    assert expected_points_from_proba(p, EP_CLASSES)[0] == pytest.approx(7.0)
    p[0, :] = 0
    p[0, list(EP_CLASSES).index("OppTouchdown")] = 1.0
    assert expected_points_from_proba(p, EP_CLASSES)[0] == pytest.approx(-7.0)
    assert EP_CLASS_VALUES["FieldGoal"] == 3.0
