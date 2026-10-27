"""Team-aware checker: empirical-Bayes shifts, season-to-date only, spread model for real games."""
from __future__ import annotations

import json
import re
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from nfl_sim.models.fourth_down import FourthDownAnalyzer
from nfl_sim.models.team_strength import Prior, TeamStrengthModel, method_of_moments
from nfl_sim.models.wp_model import WPModel
from nfl_sim.products import fourth_downs
from nfl_sim.products.engine import EngineInput, FourthDownEngine
from tests.test_fourth_down import _toy_empirics, _toy_wp_model

FX = Path(__file__).parent / "fixtures"
TEAMS = ["AAA", "BBB", "CCC", "DDD"]


def _season(seed: int = 0, n_weeks: int = 6) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for w in range(n_weeks):
        date = (pd.Timestamp("2024-09-10") + pd.Timedelta(days=7 * w)).strftime("%Y-%m-%d")
        for home, away in ((TEAMS[w % 4], TEAMS[(w + 1) % 4]), (TEAMS[(w + 2) % 4], TEAMS[(w + 3) % 4])):
            gid = f"2024_{w + 1:02d}_{away}_{home}"
            for pos, de in ((home, away), (away, home)):
                for _ in range(20):
                    rows.append(dict(game_id=gid, season=2024, season_type="REG", game_date=date, home_team=home,
                                     away_team=away, posteam=pos, defteam=de, down=3, ydstogo=int(rng.integers(1, 11)),
                                     play_type="pass", first_down=int(rng.random() < 0.5), touchdown=0, qb_kneel=0,
                                     qb_spike=0, two_point_attempt=0, field_goal_result=None, kick_distance=np.nan,
                                     kicker_player_id=None))
                for _ in range(3):
                    rows.append(dict(game_id=gid, season=2024, season_type="REG", game_date=date, home_team=home,
                                     away_team=away, posteam=pos, defteam=de, down=4, ydstogo=5, play_type="field_goal",
                                     first_down=0, touchdown=0, qb_kneel=0, qb_spike=0, two_point_attempt=0,
                                     field_goal_result="made" if rng.random() < 0.8 else "missed",
                                     kick_distance=float(rng.integers(25, 55)), kicker_player_id=f"K-{pos}"))
    return pd.DataFrame(rows)


@pytest.fixture(scope="module")
def model() -> TeamStrengthModel:
    return TeamStrengthModel.fit({2023: _season(1)}, seasons=(2023,))


def test_week_one_is_league_average(model):
    sh = model.season_shifts(_season(2))
    wk1 = sh[sh["game_id"].str.startswith("2024_01_")]
    assert (wk1[["convert_off_shift", "convert_def_shift", "fg_make_shift"]] == 0).all().all()
    assert (wk1[["n_off", "n_def", "n_fg"]] == 0).all().all()


def test_no_future_data_leaks_into_a_game(model):
    """Rewriting every result from week 4 on (incl. week 4 itself) can't change shifts for weeks 1–4."""
    pbp = _season(3)
    base = model.season_shifts(pbp).set_index(["game_id", "team"])
    fut = pbp.copy()
    later = fut["game_date"] >= "2024-10-01"  # week 4 = 2024-10-01
    fut.loc[later, "first_down"] = 1
    fut.loc[later, "field_goal_result"] = np.where(fut.loc[later, "play_type"] == "field_goal", "missed", None)
    alt = model.season_shifts(fut).set_index(["game_id", "team"])
    keep = [i for i in base.index if i[0] < "2024_05"]
    pd.testing.assert_frame_equal(base.loc[keep], alt.loc[keep])
    later_ids = [i for i in base.index if i[0] >= "2024_05"]
    assert not base.loc[later_ids].equals(alt.loc[later_ids])  # the rewrite does matter afterwards
    # and dropping the future entirely gives the same answer too
    drop = model.season_shifts(pbp[~later]).set_index(["game_id", "team"])
    pd.testing.assert_frame_equal(base.loc[[i for i in keep if i in drop.index]], drop.loc[[i for i in keep if i in drop.index]])


def test_shrinkage_pulls_small_samples_to_league_average():
    from nfl_sim.models.team_strength import _shrink

    r = pd.Series([0.5] * 10)  # converted 10/10 at a 50% league rate
    assert _shrink(r, 400.0) == pytest.approx(5 / 410)
    assert _shrink(pd.Series([0.5] * 10_000), 400.0) == pytest.approx(0.5, abs=0.02)


def test_method_of_moments_recovers_team_spread():
    rng = np.random.default_rng(7)
    n = np.full(4000, 200)
    true = rng.normal(0, 0.05, n.size)
    o = rng.binomial(n, 0.5 + true)
    pr = method_of_moments(o, np.full(n.size, 100.0), n)
    assert pr.tau == pytest.approx(0.05, rel=0.1) and pr.k == pytest.approx(0.25 / 0.05**2, rel=0.25)


@pytest.fixture(scope="module")
def engine():
    toy = FourthDownAnalyzer(_toy_wp_model(), _toy_empirics())
    spread = FourthDownAnalyzer(WPModel.load(FX / "wp_spread" / "wp_spread_model.joblib"), _toy_empirics())
    return FourthDownEngine(toy, spread)


def _x(**kw):
    return EngineInput(**{**dict(yardline_100=40, distance=3, score_differential=0, qtr=4,
                                 quarter_seconds_remaining=300), **kw})


def test_generic_what_ifs_ignore_team_context(engine):
    plain = FourthDownEngine(engine.analyzer)
    assert engine.evaluate(_x()) == plain.evaluate(_x())


def test_better_offense_and_kicker_raise_their_options(engine):
    base = engine.evaluate(_x())
    assert engine.evaluate(_x(convert_shift=0.05)).wp["go"] > base.wp["go"]
    assert engine.evaluate(_x(fg_make_shift=0.05)).wp["fg"] > base.wp["fg"]
    assert engine.evaluate(_x(convert_shift=-0.05)).wp["go"] < base.wp["go"]


def test_real_games_use_the_spread_model_from_the_home_side(engine):
    fav = engine.evaluate(_x(qtr=1, quarter_seconds_remaining=600, home_spread=7.0))
    dog = engine.evaluate(_x(qtr=1, quarter_seconds_remaining=600, home_spread=-7.0))
    assert fav.wp["go"] > dog.wp["go"] + 0.05
    away = engine.evaluate(_x(qtr=1, quarter_seconds_remaining=600, home_spread=7.0, is_home_possession=False))
    assert away.wp["go"] < fav.wp["go"]  # same spread, the away offense is the underdog


def test_real_game_rows_carry_shifts_but_no_spread_in_output(engine):
    row = dict(yardline_100=40, ydstogo=3, score_differential=0, qtr=2, quarter_seconds_remaining=200,
               posteam="AAA", home_team="AAA", season=2024, convert_shift=0.02, fg_make_shift=-0.01,
               _home_spread=3.5)
    x = fourth_downs.real_game_input(row)
    assert (x.convert_shift, x.fg_make_shift, x.home_spread) == (0.02, -0.01, 3.5)
    assert fourth_downs.real_game_input({**row, "_home_spread": float("nan")}).home_spread is None
    out = json.dumps(engine.evaluate(x).to_dict())
    assert not re.search(r"spread|odds|line|betting|vegas", out, re.I)


def test_checker_stays_disabled():
    src = (Path(__file__).parents[2] / "frontend" / "lib" / "features.ts").read_text()
    assert "export const CHECKER_ENABLED = false;" in src


def test_priors_are_reported_by_the_model(model):
    p = model.priors()
    assert set(p) == {"offense_convert", "defense_convert", "kicker_fg_make"}
    assert all(isinstance(v, dict) and v["k"] > 0 for v in p.values())
    assert isinstance(model.offense, Prior)
