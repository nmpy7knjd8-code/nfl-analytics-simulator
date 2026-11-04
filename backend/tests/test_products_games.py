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


@pytest.mark.parametrize("scores,want", [((20, 21), 0.0), ((24, 21), 1.0), ((23, 23), 0.5)])
def test_end_game_row_carries_final_result_not_fallback(scores, want):
    """QA 2026-10-28 Q1: END GAME's fallback WP (DET_KC: 0.186) made Goff's last kneel a fake 15-pt swing."""
    game = {"id": "t", "season": 2023, "season_type": "REG", "home": "KC", "away": "DET",
            "home_score": scores[0], "away_score": scores[1]}
    pre = {0.0: 0.042, 1.0: 0.97, 0.5: 0.49}[want]
    plays = pd.DataFrame({"game_id": ["t"] * 2, "play_id": [1.0, 2.0], "qtr": [4, 4],
                          "quarter_seconds_remaining": [37, 0], "game_seconds_remaining": [37, 0],
                          "posteam": ["DET", None], "down": [1, None], "ydstogo": [10, None],
                          "yardline_100": [77, None], "desc": ["kneel", "END GAME"], "play_type": ["qb_kneel", None],
                          "home_wp": [pre, 0.186], "total_home_score": [scores[0]] * 2,
                          "total_away_score": [scores[1]] * 2})
    doc = games.game_doc(game, plays, {}, {"source": "nflverse"})
    kneel, end = doc["plays"]
    assert end["home_wp"] == want and end["home_wp_after"] == want and doc["final_home_wp"] == want
    assert kneel["home_wp_after"] == want and not kneel["swing"] and not end["swing"]
    assert doc["swing_play_ids"] == []


def _rows(descs, types, wps, scores):
    n = len(descs)
    return pd.DataFrame({"game_id": ["t"] * n, "play_id": [float(i + 1) for i in range(n)], "qtr": [4] * n,
                         "quarter_seconds_remaining": [300 - 10 * i for i in range(n)],
                         "game_seconds_remaining": [300 - 10 * i for i in range(n)],
                         "posteam": ["BUF"] * n, "down": [1] * n, "ydstogo": [10] * n, "yardline_100": [50] * n,
                         "desc": descs, "play_type": types, "home_wp": wps,
                         "total_home_score": [scores[0]] * n, "total_away_score": [scores[1]] * n})


def test_end_of_game_text_row_carries_final_result():
    """QA 2026-10-28 R1: 2019 BUF-home 'End of game - 4.17 pm' rows (CIN_BUF 4766: 0.585 -> 1.0)."""
    game = {"id": "t", "season": 2019, "season_type": "REG", "home": "BUF", "away": "CIN",
            "home_score": 21, "away_score": 17}
    plays = _rows(["kneel", "End of game - 4.17 pm"], ["qb_kneel", None], [0.97, 0.585], (21, 17))
    doc = games.game_doc(game, plays, {}, {"source": "nflverse"})
    kneel, end = doc["plays"]
    assert end["home_wp"] == 1.0 and doc["final_home_wp"] == 1.0
    assert kneel["home_wp_after"] == 1.0 and not kneel["swing"] and not end["swing"]
    assert doc["swing_play_ids"] == []


def test_rows_without_play_type_are_never_swings():
    """QA 2026-10-28 R1: delay/notes rows with stand-in WPs ('The game has resumed.') were flagged."""
    game = {"id": "t", "season": 2019, "season_type": "REG", "home": "CAR", "away": "TB",
            "home_score": 20, "away_score": 14}
    plays = _rows(["pass", "The game has resumed.", "run", "pass", "END GAME"],
                  ["pass", None, "run", "pass", None], [0.5, 0.32, 0.68, 0.70, 0.3], (20, 14))
    doc = games.game_doc(game, plays, {}, {"source": "nflverse"})
    flagged = {r["play_id"] for r in doc["plays"] if r["swing"]}
    assert 2 not in doc["swing_play_ids"] and 2 not in flagged
    assert set(doc["swing_play_ids"]) == flagged == {1, 4}  # real plays: 0.5->0.32, 0.70->1.0 (result)
    assert doc["plays"][3]["home_wp_after"] == 1.0


def test_is_end_game_text():
    assert games.is_end_game_text("END GAME") and games.is_end_game_text("End of game - 4.17 pm")
    assert not games.is_end_game_text("End of half - 2.43 pm") and not games.is_end_game_text("END QUARTER 4")
    assert not games.is_end_game_text(None)


_PRE_Q1_RELEASES = {"games-v2", "games-v3", "games-v4"}  # built before the END GAME fix


@pytest.mark.skipif(os.environ.get("GAMES_RELEASE_TAG") in _PRE_Q1_RELEASES,
                    reason="game files come from a release built before the END GAME fix (games-v5+)")
@pytest.mark.parametrize("path", [p for p in _game_files()], ids=lambda p: p.stem)
def test_game_file_end_game_row_is_final_result(path):
    doc = json.loads(path.read_text())
    c = doc["cols"]
    for i, t in enumerate(c["text"]):
        if games.is_end_game_text(t) and c["home_wp"][i] is not None:
            assert c["home_wp"][i] == doc["final_home_wp"], (i, c["home_wp"][i])
    # QA 2026-10-28 R1: rows with no play type are never swings.
    no_type = {c["play_id"][i] for i, pt in enumerate(c["play_type"]) if pt is None}
    assert not no_type & set(doc["swing_play_ids"]), sorted(no_type & set(doc["swing_play_ids"]))


def _has_display_text():
    files = _game_files()
    return bool(files) and "display_text" in json.loads(files[0].read_text())["cols"]


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


_DET_KC = next((p for p in _game_files() if p.stem == "2023_01_DET_KC"), None)


@pytest.mark.skipif(_DET_KC is None or os.environ.get("GAMES_RELEASE_TAG") in _PRE_Q1_RELEASES,
                    reason="needs games-v5+ game files")
def test_det_kc_final_kneel_is_not_a_swing():
    """QA 2026-10-28 Q1: Goff's Q4 0:37 kneel (4204) read 'DET's win chance down 15%' though DET won."""
    doc = json.loads(_DET_KC.read_text())
    c = doc["cols"]
    i = c["play_id"].index(4204)
    assert c["play_type"][i] == "qb_kneel" and c["qtr"][i] == 4 and c["sec"][i] == 37
    assert doc["final_home_wp"] == 0.0 and 4204 not in doc["swing_play_ids"]
