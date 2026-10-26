"""Coach aggregates: Phase 4 must be able to leave <20-call coaches ungraded."""
import json

import pandas as pd

from nfl_sim.products import coaches, fourth_downs
from nfl_sim.products.meta import PRODUCTS_DIR


def _eng(rec, wp, close=False):
    return json.dumps({"recommendation": rec, "wp": wp, "close_call": close, "gap_pts": 5.0})


def _rows(n, actual, rec="go", coach="A Coach", close=False):
    return pd.DataFrame({
        "game_id": [f"g{i}" for i in range(n)], "play_id": range(n), "week": 1, "defteam": "OPP", "qtr": 4,
        "ydstogo": 1, "yardline_100": 50, "score_differential": 0, "actual": actual, "result": "x", "desc": "d",
        "posteam": "DET", "is_home_possession": True, "home_coach": coach, "away_coach": "Other",
        "engine": [_eng(rec, {"go": 0.6, "punt": 0.5}, close)] * n,
    })


def test_min_calls_rule_and_null_grade():
    t = coaches.calls_frame(pd.concat([_rows(19, "punt"), _rows(5, "go", close=True)], ignore_index=True))
    (row,) = coaches.coach_rows(t)
    assert row["calls"] == 24 and row["qualifying_calls"] == 19
    assert row["gradeable"] is False and row["grade"] is None and row["min_calls_for_grade"] == 20
    assert row["kicked_when_should_go"] == 19 and row["net_wp_pts"] == -190.0
    (row,) = coaches.coach_rows(coaches.calls_frame(_rows(20, "go")))
    assert row["gradeable"] is True and row["agreed"] == 20 and row["net_wp_pts"] == 0


def test_committed_files():
    for s in fourth_downs.SEASONS:
        d = json.loads((PRODUCTS_DIR / "coaches" / f"{s}.json").read_text())
        assert d["provenance"]["source"] == "nflverse" and d["min_calls_for_grade"] == 20
        assert len(d["coaches"]) >= 32
        for c in d["coaches"]:
            assert c["grade"] is None and c["gradeable"] == (c["qualifying_calls"] >= 20)
            assert c["qualifying_calls"] <= c["calls"] and len(c["worst"]) <= 5
