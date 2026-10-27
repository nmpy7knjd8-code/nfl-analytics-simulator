"""C7 Phase 1: games index matches nflverse; game-file WP is home-side and ends 1/0 for the winner."""
from __future__ import annotations

import json
import os

import pandas as pd
import pytest

from nfl_sim.products.game_compact import compact, expand

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
    raw = json.loads(path.read_text())
    assert raw["schema_version"] == "game.v2" and path.stat().st_size < 150_000
    doc = expand(raw)
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


def test_game_files_total_size_budget():
    total = sum(p.stat().st_size for p in _game_files())
    assert total < 75_000_000, f"{total / 1e6:.1f} MB"  # games-v3 adds display_text (~68 MB)


def test_compact_round_trip_restores_v1():
    v1 = {"schema_version": "game.v1", "provenance": {"source": "nflverse", "data_sha256": "x", "build_date": "d",
                                                      "license": "CC BY 4.0"},
          "game": {"id": "t", "home": "OAK", "away": "DEN"}, "wp_perspective": "home", "swing_threshold": 0.08,
          "final_home_wp": 1.0, "swing_play_ids": [2],
          "plays": [
              {"play_id": 1, "qtr": 4, "clock": "0:30", "posteam": "LV", "down": 4, "ydstogo": 2, "yardline_100": 30,
               "text": "(0:30) run", "display_text": "Run.", "penalty_text": None, "play_type": "run", "home_wp": 0.41234, "home_wp_after": 0.6, "swing": False,
               "home_score": 3, "away_score": 7,
               "fourth_down": {"recommendation": "go", "close_call": False, "gap_pts": 3.21, "wp": {"go": 0.41, "fg": 0.38},
                               "home_wp": {"go": 0.41, "fg": 0.38}, "options": ["go", "fg"], "actual": "go",
                               "kick_distance": 48, "engine_version": "e1"}},
              {"play_id": 2, "qtr": 4, "clock": "0:05", "posteam": "LV", "down": 1, "ydstogo": 10, "yardline_100": 5,
               "text": "(0:05) pass TD", "display_text": "Touchdown pass.", "penalty_text": None, "play_type": "pass", "home_wp": 0.6, "home_wp_after": 1.0, "swing": True,
               "home_score": 10, "away_score": 7, "fourth_down": None}]}
    back = expand(compact(v1))
    v1["plays"][0]["home_wp"] = 0.412
    assert back["plays"] == v1["plays"]  # LV-vs-OAK code mismatch handled by is_home_offense
    assert back["schema_version"] == "game.v1"


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


def _has_display_text():
    files = _game_files()
    return bool(files) and "display_text" in json.loads(files[0].read_text())["cols"]


# Text changed in lib/plays after the games-v3 release was packed (QA 0019 N3, PR "play_text: QA 0019").
# Only for games-v3 files; games-v4 (rebuilt game files) must match exactly, so delete this when it ships.
_PENDING_REBUILD = {"games-v3": {("2023_01_DET_KC", "2228"), ("2023_01_DET_KC", "1273")}}  # 1273: QA 0116 snap order


@pytest.mark.skipif(not _has_display_text(), reason="game files predate games-v3 (no display_text column)")
def test_game_files_display_text_nonempty_and_matches_lib_plays():
    from pathlib import Path
    lib = Path(__file__).resolve().parents[2] / "frontend/lib/plays"
    for path in _game_files():
        c = json.loads(path.read_text())["cols"]
        assert len(c["display_text"]) == len(c["play_id"])
        assert all(isinstance(t, str) and t.strip() for t in c["display_text"]), path.stem
        shared = lib / f"{path.stem}.json"
        if shared.exists():
            got = dict(zip(map(str, c["play_id"]), c["display_text"]))
            pen = dict(zip(map(str, c["play_id"]), c["penalty_text"]))
            for p in json.loads(shared.read_text())["plays"]:
                if (path.stem, p["play_id"]) in _PENDING_REBUILD.get(os.environ.get("GAMES_RELEASE_TAG", ""), ()):
                    continue
                assert got[p["play_id"]] == p["display_text"], (path.stem, p["play_id"])
                assert pen[p["play_id"]] == p["penalty_text"], (path.stem, p["play_id"])


def test_game_flow_rows_get_display_text():
    got = games.play_display_texts([{"game_id": "2023_01_X_Y", "desc": d} for d in (
        "GAME", "END QUARTER 1", "END GAME", "Two-Minute Warning", "Timeout #1 by BUF at 01:23.")], {}, {})
    assert got == ["Start of game.", "End of quarter 1.", "End of game.", "Two-minute warning.", "Timeout by BUF."]


def test_compact_round_trips_display_text():
    doc = {"plays": [{"play_id": 1, "qtr": 1, "clock": "15:00", "posteam": "BUF", "down": None, "ydstogo": None,
                      "yardline_100": None, "text": "GAME", "display_text": "Start of game.", "penalty_text": None, "play_type": None,
                      "home_wp": 0.5, "home_wp_after": 0.5, "swing": False, "home_score": 0, "away_score": 0,
                      "fourth_down": None}],
           "provenance": {"source": "nflverse"}, "game": {}, "wp_perspective": "home", "swing_threshold": 0.08,
           "final_home_wp": 0.5, "swing_play_ids": []}
    assert expand(compact(doc))["plays"][0]["display_text"] == "Start of game."
