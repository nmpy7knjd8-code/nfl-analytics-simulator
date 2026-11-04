"""WP series contract: home perspective, pre-snap, swing flag, overtime."""

from __future__ import annotations

import pytest

from nfl_sim.models.wp_series import build_wp_series, game_seconds_elapsed, home_wp_of

GAME = {"game_id": "2023_01_DET_KC", "home_team_id": "KC", "away_team_id": "DET",
        "home_score": 20, "away_score": 21, "season_type": "REG"}


def _play(i, *, q=4, gsr=100, home_wp=None, wp=None, home_poss=None, team="DET"):
    return {"play_id": str(i), "play_index": i, "quarter": q, "game_seconds_remaining": gsr,
            "possession_team_id": team, "is_home_possession": home_poss,
            "reference": {"home_wp": home_wp, "wp": wp}}


def test_regression_det_kc_final_is_home_perspective():
    """DET (away) won 21–20 at KC. nflverse `wp` on DET's kneel-downs is ~0.92 for
    the possession team (DET). Charted as-is it reads like the home team at 92%→100%.
    The series must be home (KC) perspective and end at 0.0 for KC."""
    plays = [
        _play(0, gsr=97, wp=0.898, home_poss=False),
        _play(1, gsr=62, wp=0.904, home_poss=False),
        _play(2, gsr=37, wp=0.918, home_poss=False),
    ]
    s = build_wp_series(GAME, plays, swing_threshold=0.08)
    assert s.result == "away_win" and s.perspective == "home"
    assert [round(p.home_wp_pre, 3) for p in s.points] == [0.102, 0.096, 0.082]
    assert s.points[-1].home_wp_post == 0.0
    assert all(p.home_wp_pre < 0.5 for p in s.points)
    # Final step 0.082 -> 0.0 is a swing at 0.08 but not at 0.10 (configurable)
    assert s.swing_play_ids == ["2"]
    assert build_wp_series(GAME, plays, swing_threshold=0.10).swing_play_ids == []


def test_prefers_reference_home_wp_and_flips_possession_wp():
    assert home_wp_of(_play(0, home_wp=0.3, wp=0.9, home_poss=False)) == 0.3
    assert home_wp_of(_play(0, wp=0.9, home_poss=True)) == 0.9
    assert home_wp_of(_play(0, wp=0.9, home_poss=False)) == pytest.approx(0.1)
    assert home_wp_of(_play(0, wp=0.9, home_poss=None)) is None


def test_swing_threshold_inclusive_and_deltas():
    plays = [_play(0, home_wp=0.50), _play(1, home_wp=0.58), _play(2, home_wp=0.60)]
    s = build_wp_series({**GAME, "home_score": 30, "away_score": 0}, plays, swing_threshold=0.08)
    assert [p.is_swing for p in s.points] == [True, False, True]
    assert s.points[0].delta_home_wp == pytest.approx(0.08)
    with pytest.raises(ValueError):
        build_wp_series(GAME, plays, swing_threshold=0.0)


def test_overtime_clock_is_monotone_and_tie_ends_half():
    assert game_seconds_elapsed(4, 0, "REG") == 3600
    assert game_seconds_elapsed(5, 600, "REG") == 3600
    assert game_seconds_elapsed(5, 0, "REG") == 4200
    assert game_seconds_elapsed(5, 900, "POST") == 3600
    plays = [_play(0, q=4, gsr=5, home_wp=0.5), _play(1, q=5, gsr=600, home_wp=0.55),
             _play(2, q=5, gsr=10, home_wp=0.5)]
    s = build_wp_series({**GAME, "home_score": 20, "away_score": 20}, plays, swing_threshold=0.08)
    assert s.has_overtime and s.result == "tie"
    assert [p.is_overtime for p in s.points] == [False, True, True]
    xs = [p.game_seconds_elapsed for p in s.points]
    assert xs == sorted(xs)
    assert s.points[-1].home_wp_post == 0.5


def test_api_win_probability_endpoint(synthetic_store):
    from fastapi.testclient import TestClient

    from nfl_sim.api.app import create_app
    from nfl_sim.store import CanonicalStore

    client = TestClient(create_app(store=CanonicalStore(synthetic_store)))
    r = client.get("/games/2023_01_DET_KC/win-probability")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["perspective"] == "home" and body["timing"] == "pre_snap"
    assert body["swing_threshold"] == 0.08
    assert body["home_team_id"] == "KC" and body["result"] == "away_win"
    assert body["points"][-1]["home_wp_post"] == 0.0
    assert body["swing_play_ids"] == [p["play_id"] for p in body["points"] if p["is_swing"]]
    r2 = client.get("/games/2023_01_DET_KC/win-probability", params={"swing_threshold": 0.6})
    assert r2.json()["swing_play_ids"] == []
    assert client.get("/games/2023_01_DET_KC/win-probability", params={"swing_threshold": 0}).status_code == 422
    assert client.get("/games/nope/win-probability").status_code == 404
