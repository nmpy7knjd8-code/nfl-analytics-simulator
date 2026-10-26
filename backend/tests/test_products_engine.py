"""One shared 4th-down engine: option rules, home view, close calls, grid parity."""
from __future__ import annotations

import pytest

from nfl_sim.models.fourth_down import FourthDownAnalyzer
from nfl_sim.products import grid
from nfl_sim.products.engine import EngineInput, FourthDownEngine
from tests.test_fourth_down import _toy_empirics, _toy_wp_model


@pytest.fixture(scope="module")
def engine():
    return FourthDownEngine(FourthDownAnalyzer(_toy_wp_model(), _toy_empirics()))


def _x(**kw):
    base = dict(yardline_100=40, distance=3, score_differential=0, qtr=4, quarter_seconds_remaining=300)
    return EngineInput(**{**base, **kw})


@pytest.mark.parametrize("yl,opts", [(1, ("go", "fg")), (35, ("go", "fg")), (36, ("go", "fg", "punt")),
                                     (47, ("go", "fg", "punt")), (48, ("go", "punt")), (99, ("go", "punt"))])
def test_option_rules(engine, yl, opts):
    out = engine.evaluate(_x(yardline_100=yl, distance=1))
    assert out.options == opts and set(out.wp) == set(opts)
    assert out.recommendation in opts
    assert out.kick_distance == yl + 17


def test_no_field_goal_beyond_64_yards_ever(engine):
    for yl in range(48, 100):
        assert "fg" not in engine.evaluate(_x(yardline_100=yl, distance=1)).wp


def test_home_view_flips_for_away_offense(engine):
    h = engine.evaluate(_x(is_home_possession=True))
    a = engine.evaluate(_x(is_home_possession=False))
    for o in a.wp:
        assert a.home_wp[o] == pytest.approx(1 - a.wp[o], abs=1e-9)
    assert h.home_wp == h.wp


def test_close_call_and_gap(engine):
    out = engine.evaluate(_x())
    vals = sorted(out.wp.values(), reverse=True)
    assert out.gap_pts == round((vals[0] - vals[1]) * 100, 2)
    assert out.close_call == (out.gap_pts < 2.0)


def test_deterministic(engine):
    assert engine.evaluate(_x()).to_dict() == engine.evaluate(_x()).to_dict()


@pytest.mark.parametrize("bad", [dict(qtr=5), dict(quarter_seconds_remaining=901), dict(distance=0),
                                 dict(yardline_100=3, distance=5), dict(posteam_timeouts=4)])
def test_rejects_impossible_situations(bad):
    with pytest.raises(ValueError):
        _x(**bad)


def test_clock_derivation():
    x = _x(qtr=2, quarter_seconds_remaining=120)
    assert (x.game_seconds_remaining, x.half_seconds_remaining) == (2 * 900 + 120, 120)
    x = _x(qtr=3, quarter_seconds_remaining=450)
    assert (x.game_seconds_remaining, x.half_seconds_remaining) == (900 + 450, 900 + 450)


def test_grid_cells_equal_engine_values(engine, monkeypatch):
    """Checker (grid) and quiz (engine) return identical values for the same situation."""
    monkeypatch.setattr(grid, "_ENGINE", engine)
    for t, s, d, yl in [(0, 0, 0, 1), (7, 6, 2, 40), (6, 12, 8, 99), (3, 4, 5, 47), (4, 5, 1, 48)]:
        x = grid.grid_input(t, s, d, yl)
        c = grid.cell(x)
        out = engine.evaluate(x)
        for k, o in enumerate(("go", "fg", "punt")):
            assert (c[k] is None) == (o not in out.wp)
            if c[k] is not None:
                assert c[k] / 10000 == out.wp[o]
    assert grid.cell(grid.grid_input(0, 0, 8, 3)) is None
    assert grid.cell_index(len(grid.TIMES) - 1, len(grid.SCORE) - 1, len(grid.DIST) - 1, 99) == len(grid.TIMES) * len(grid.SCORE) * len(grid.DIST) * 99 - 1  # 4th & 15 at the 3 is impossible


def test_committed_grid_matches_real_engine():
    import json, random
    from nfl_sim.products.meta import PRODUCTS_DIR
    from nfl_sim.products.engine import load_engine
    path = PRODUCTS_DIR / "fourth_down" / "grid.json"
    doc = json.loads(path.read_text())
    assert doc["provenance"]["source"] == "nflverse"
    try:
        eng = load_engine()
    except FileNotFoundError:
        pytest.skip("WP artifact not present (gitignored); parity checked locally")
    rng = random.Random(7)
    import nfl_sim.products.grid as g
    g._ENGINE = eng
    for _ in range(40):
        t, s, d, yl = (rng.randrange(len(g.TIMES)), rng.randrange(len(g.SCORE)), rng.randrange(len(g.DIST)), rng.randrange(1, 100))
        assert doc["cells"][g.cell_index(t, s, d, yl)] == g.cell(g.grid_input(t, s, d, yl))
