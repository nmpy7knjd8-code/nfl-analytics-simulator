"""C7 Phase 1: games index matches nflverse; game-file WP is home-side and ends 1/0 for the winner."""
from __future__ import annotations

import json

import pandas as pd
import pytest

from nfl_sim.products import games
from nfl_sim.products.meta import PRODUCTS_DIR

GAMES = PRODUCTS_DIR / "games"
ODDS_KEYS = {"spread_line", "total_line", "home_moneyline", "away_moneyline", "home_spread_odds",
             "away_spread_odds", "over_odds", "under_odds", "total", "result"}


def _index(season):
    return json.loads((GAMES / f"{season}.json").read_text())


def _game_files():
    return sorted(p for p in GAMES.glob("*_*_*.json"))


@pytest.mark.parametrize("season", games.SEASONS)
def test_index_has_provenance_and_no_odds(season):
    doc = _index(season)
    prov = doc["provenance"]
    assert prov["source"] == "nflverse" and prov["nflreadpy_version"] and prov["data_sha256"] and prov["build_date"]
    for g in doc["games"]:
        assert not (ODDS_KEYS & set(g)) and not any("odds" in k or "line" in k for k in g)


@pytest.fixture(scope="module")
def schedules():
    try:
        return games.load_schedules()
    except Exception as e:  # network
        pytest.skip(f"nflverse schedules unavailable: {e}")


@pytest.mark.parametrize("season", games.SEASONS)
def test_index_matches_nflverse_final_scores_100pct(season, schedules):
    s = schedules[(schedules["season"] == season) & schedules["home_score"].notna()].set_index("game_id")
    idx = _index(season)["games"]
    assert {g["id"] for g in idx} == set(s.index)
    for g in idx:
        r = s.loc[g["id"]]
        assert (g["home"], g["away"], g["home_score"], g["away_score"], g["week"], g["date"]) == (
            r["home_team"], r["away_team"], int(r["home_score"]), int(r["away_score"]), int(r["week"]), str(r["gameday"]))


@pytest.mark.parametrize("season", games.SEASONS)
def test_every_index_game_has_a_game_file(season):
    for g in _index(season)["games"]:
        assert (GAMES / f"{g['id']}.json").exists(), g["id"]


@pytest.mark.parametrize("path", _game_files(), ids=lambda p: p.stem)
def test_game_file_wp_home_side_ends_at_result(path):
    doc = json.loads(path.read_text())
    g = doc["game"]
    assert doc["wp_perspective"] == "home" and doc["provenance"]["source"] == "nflverse"
    idx = {x["id"]: x for x in _index(g["season"])["games"]}
    assert idx[g["id"]] == g
    want = 1.0 if g["home_score"] > g["away_score"] else 0.0 if g["home_score"] < g["away_score"] else 0.5
    assert doc["final_home_wp"] == want
    wp = [p for p in doc["plays"] if p["home_wp"] is not None]
    assert wp[-1]["home_wp_after"] == want
    assert all(0 <= p["home_wp"] <= 1 for p in wp)
    last = [p for p in doc["plays"] if p["home_score"] is not None][-1]
    assert (last["home_score"], last["away_score"]) == (g["home_score"], g["away_score"])
    assert set(doc["swing_play_ids"]) == {p["play_id"] for p in doc["plays"] if p["swing"]}
    for p in doc["plays"]:
        fd = p["fourth_down"]
        if fd is not None:
            assert p["down"] == 4 and ("fg" in fd["wp"]) == (p["yardline_100"] + 18 <= 64)


def test_home_view_flip_from_synthetic_rows():
    """Away team leading late: chart must show the home side low, and end at 0."""
    game = {"id": "t", "season": 2023, "season_type": "REG", "home": "KC", "away": "DET",
            "home_score": 20, "away_score": 21}
    plays = pd.DataFrame({"game_id": ["t"] * 2, "play_id": [1.0, 2.0], "qtr": [4, 4],
                          "quarter_seconds_remaining": [30, 0], "game_seconds_remaining": [30, 0],
                          "posteam": ["DET", None], "down": [1, None], "ydstogo": [10, None],
                          "yardline_100": [70, None], "desc": ["kneel", "END GAME"], "play_type": ["qb_kneel", None],
                          "home_wp": [0.05, 0.0], "total_home_score": [20, 20], "total_away_score": [21, 21]})
    doc = games.game_doc(game, plays, {}, {"source": "nflverse"})
    assert doc["final_home_wp"] == 0.0 and doc["plays"][0]["home_wp"] == 0.05
    assert doc["plays"][0]["clock"] == "0:30"
