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
        "wp": 0.55, "wpa": 0.10,
    })


def test_wp_before_after_and_signed_net_value():
    # Coach punts when go is best (cost 10 pts); real play ends at .65, 15 pts above punt's .50.
    (row,) = coaches.coach_rows(coaches.calls_frame(_rows(20, "punt")))
    assert row["games"] == 20 and row["wp_cost_pts_total"] == 200.0 and row["net_wp_pts"] == -200.0
    assert row["decision_value_pts"] == -200.0 and row["outcome_vs_expected_pts"] == 300.0
    assert row["net_value_pts"] == 100.0
    w = row["worst"][0]
    assert (w["wp_before"], w["wp_after_chosen"], w["wp_after_best"], w["wp_after_actual"]) == (0.55, 0.5, 0.6, 0.65)
    assert w["decision_value_pts"] == -10.0 and w["net_value_pts"] == 5.0
    # Agreeing with the engine earns the gap (5 pts here).
    (row,) = coaches.coach_rows(coaches.calls_frame(_rows(20, "go")))
    assert row["decision_value_pts"] == 100.0 and row["best"][0]["decision_value_pts"] == 5.0


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
            assert 1 <= c["games"] <= 21 and c["net_wp_pts"] == -c["wp_cost_pts_total"]
            for p in c["best"] + c["worst"]:
                assert 0 <= p["wp_after_chosen"] <= 1 and p["wp_after_best"] >= p["wp_after_chosen"]
                assert abs(p["decision_value_pts"] + (0 if p in c["best"] else p["wp_cost_pts"])) < 0.02 or p in c["best"]
