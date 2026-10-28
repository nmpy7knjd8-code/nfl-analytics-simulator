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
        "wp": 0.55, "wpa": 0.10, "quarter_seconds_remaining": 125, "season": 2023,
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
                assert "play_id" not in p and {"game_id", "qtr", "clock"} <= p.keys()
                if p["actual"] == p["recommendation"]:
                    assert p["alt_cost_pts"] > 0
                else:
                    assert abs(p["alt_cost_pts"] + p["wp_cost_pts"]) <= 0.011
                assert 0 <= p["wp_after_chosen"] <= 1 and p["wp_after_best"] >= p["wp_after_chosen"]
                assert abs(p["decision_value_pts"] + (0 if p in c["best"] else p["wp_cost_pts"])) < 0.02 or p in c["best"]


def test_alt_cost_matches_gap_and_cost():
    # agreed: alt = chosen − best other = gap; missed: alt = chosen − best = −cost
    df = pd.concat([_rows(3, "go"), _rows(3, "punt")], ignore_index=True)
    df["engine"] = json.dumps({"recommendation": "go", "wp": {"go": 0.6, "punt": 0.5}, "close_call": False,
                               "gap_pts": 10.0})
    t = coaches.calls_frame(df)
    agreed = t[t["actual"] == t["rec"]]
    assert ((agreed["alt_cost"] - agreed["gap"]).abs() < 1e-9).all()
    missed = t[t["actual"] != t["rec"]]
    assert ((missed["alt_cost"] + missed["cost"]).abs() < 1e-9).all()


def test_three_options_alt_cost_uses_best_other():
    df = _rows(1, "fg")
    df["engine"] = [_eng("fg", {"go": 0.40, "punt": 0.35, "fg": 0.52})]
    (r,) = coaches.calls_frame(df).to_dict("records")
    assert round(r["alt_cost"], 6) == 12.0
    df["actual"] = "punt"
    (r,) = coaches.calls_frame(df).to_dict("records")
    assert round(r["alt_cost"], 6) == -17.0 and round(r["cost"], 6) == 17.0


def test_best_ranked_by_alt_cost_and_keyed_without_play_id():
    df = _rows(20, "go")
    df["engine"] = [_eng("go", {"go": 0.5 + i / 100, "punt": 0.5}) for i in range(20)]
    (row,) = coaches.coach_rows(coaches.calls_frame(df))
    assert [p["alt_cost_pts"] for p in row["best"]] == [19.0, 18.0, 17.0, 16.0, 15.0]
    p = row["best"][0]
    assert "play_id" not in p and (p["game_id"], p["qtr"], p["clock"]) == ("g19", 4, "2:05")
    (c,) = [coaches._call(r) for r in coaches.calls_frame(df.head(1)).assign(coach="A Coach").to_dict("records")]
    assert "play_id" not in c and c["alt_cost_pts"] == 0.0 and c["clock"] == "2:05"


def test_committed_calls_files_keyed_uniquely():
    for s in fourth_downs.SEASONS:
        d = json.loads((PRODUCTS_DIR / "coaches" / "calls" / f"{s}.json").read_text())
        keys = [(c["game_id"], c["qtr"], c["clock"]) for c in d["calls"]]
        assert d["calls"] and len(keys) == len(set(keys))
        assert all("play_id" not in c and c["qtr"] <= 4 for c in d["calls"])
