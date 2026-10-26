"""Shared play-level engine table (runs where the nflverse lake + WP artifact were built)."""
import json

import pandas as pd
import pytest

from nfl_sim.products import fourth_downs


def test_receive_2h_ko_from_opening_kickoff():
    pbp = pd.DataFrame({"game_id": ["g", "g"], "play_id": [1, 2], "play_type": ["kickoff", "pass"],
                        "qtr": [1, 1], "posteam": ["DET", "DET"]})
    assert fourth_downs.opening_receivers(pbp) == {"g": "DET"}


@pytest.fixture(scope="module")
def table():
    try:
        return fourth_downs.load()
    except FileNotFoundError:
        pytest.skip("product cache not built in this environment")


def test_covers_2019_2025_real_plays(table):
    assert set(table["season"]) == set(fourth_downs.SEASONS)
    assert (table["down"] == 4).all() and (table["qtr"] <= 4).all()
    assert table["desc"].notna().all() and not table.duplicated(["game_id", "play_id"]).any()


def test_engine_rules_hold_on_every_play(table):
    for yl, e in zip(table["yardline_100"], table["engine"]):
        d = json.loads(e)
        assert ("fg" in d["wp"]) == (yl + 18 <= 64)
        assert ("punt" in d["wp"]) == (yl >= 35)
        assert d["recommendation"] in d["wp"]
