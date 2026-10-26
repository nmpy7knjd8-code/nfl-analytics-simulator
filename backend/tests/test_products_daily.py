"""C7 Phase 1: ≥365 daily items (Today's 5 → ≥1,825), 0 synthetic, no FG beyond 64, no repeats."""
from __future__ import annotations

import json
from collections import Counter
from datetime import date, timedelta

import pytest

from nfl_sim.products import daily
from nfl_sim.products.meta import PRODUCTS_DIR

PACK = json.loads((PRODUCTS_DIR / "daily" / "pack.json").read_text())
ITEMS = PACK["items"]
# Keys read by frontend/scripts/build-daily-pack.mjs slim() in PR #53.
SLIM_SITUATION = ("posteam", "defteam", "home_team", "away_team", "posteam_score", "defteam_score", "qtr",
                  "quarter_seconds_remaining", "yardline_100", "down", "distance")


def test_size_schedule_and_no_repeat_within_365_days():
    assert len(ITEMS) >= 365 * 5
    assert len({i["id"] for i in ITEMS}) == len(ITEMS)
    days = Counter(i["date"] for i in ITEMS)
    start = date.fromisoformat(PACK["start_date"])
    assert sorted(days) == [(start + timedelta(d)).isoformat() for d in range(365)]
    assert set(days.values()) == {5} and PACK["timezone"] == "America/New_York"


def test_balanced_and_close_calls_capped():
    c = Counter(i["reveal"]["recommendation"] for i in ITEMS)
    assert set(c) == {"go", "fg", "punt"} and max(c.values()) - min(c.values()) <= 1
    assert sum(i["reveal"]["close_call"] for i in ITEMS) <= 0.15 * len(ITEMS)


def test_option_rules_and_kick_cap():
    for i in ITEMS:
        s, r = i["situation"], i["reveal"]
        assert r["kick_distance"] == s["yardline_100"] + 18
        assert ("fg" in r["values"]) == (r["kick_distance"] <= 64)
        assert ("punt" in r["values"]) == (s["yardline_100"] >= 35)
        assert r["recommendation"] == min(r["options"], key=lambda o: (-r["values"][o], r["options"].index(o)))  # ties → option order
        for o, v in r["values"].items():
            assert r["home_values"][o] == (v if s["is_home_possession"] else pytest.approx(1 - v, abs=1e-4))


def test_shape_compatible_with_build_daily_pack_mjs():
    for i in ITEMS:
        assert i["kind"] == "historical" and i["historical_action"] in ("go", "fg", "punt")
        assert {"season", "week", "game_date", "game_id"} <= set(i["source"])
        assert all(k in i["situation"] for k in SLIM_SITUATION)
        assert i["what_happened"]["desc"] and i["what_happened"]["result"]
        assert i["crowd_split"] is None


def test_provenance():
    p = PACK["provenance"]
    assert p["source"] == "nflverse" and p["nflreadpy_version"] and p["data_sha256"] and p["build_date"]


def test_zero_synthetic_every_item_is_an_nflverse_row():
    from nfl_sim.products.fourth_downs import load_pbp
    try:
        by_season = {s: load_pbp(s, ["game_id", "play_id", "desc", "down", "ydstogo", "yardline_100",
                                     "posteam", "posteam_score", "defteam_score", "qtr",
                                     "quarter_seconds_remaining"])
                     for s in sorted({i["source"]["season"] for i in ITEMS})}
    except FileNotFoundError:
        pytest.skip("nflverse lake not present")
    for s, df in by_season.items():
        idx = df.set_index(["game_id", "play_id"])
        for i in (x for x in ITEMS if x["source"]["season"] == s):
            row = idx.loc[(i["source"]["game_id"], float(i["source"]["play_id"]))]
            st = i["situation"]
            assert row["desc"] == i["what_happened"]["desc"] and row["down"] == 4
            assert (row["ydstogo"], row["yardline_100"], row["posteam"], row["qtr"]) == (
                st["distance"], st["yardline_100"], st["posteam"], st["qtr"])
            assert (row["posteam_score"], row["defteam_score"]) == (st["posteam_score"], st["defteam_score"])


def test_selection_prefers_out_of_training_seasons():
    assert all(not i["source"]["in_engine_training"] for i in ITEMS) or "backfill" in PACK["selection"]
    assert set(daily.TRAINING_SEASONS) == {2019, 2020, 2021}
