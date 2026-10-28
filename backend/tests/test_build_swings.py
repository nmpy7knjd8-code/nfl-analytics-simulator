"""mining/build_swings.py: C2/C3 swings.json (shared swing filter, nflverse values, frozen weeks)."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_swings", ROOT / "mining/build_swings.py")
bs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bs)

ROWS = json.loads((ROOT / "backend/tests/fixtures/swings_pbp_rows.json").read_text())
SITE = ROOT / "data/site/swings.json"
RECORD_KEYS = {"season", "week", "round", "game_id", "home", "away", "team", "qtr", "clock", "down", "togo",
               "yardline_100", "play_type", "desc", "wp_before", "wp_after", "swing"}
BANNED_KEY = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|line|odds|total", re.I)


@pytest.fixture(scope="module")
def built():
    return bs.build(ROWS)


def _records(out):
    return list(out["weeks"].values()) + out["top"]


def test_values_match_nflverse_exactly(built):
    src = {(r["game_id"], r["qtr"], r["time"], r["desc"]): r for r in ROWS}
    for rec in _records(built):
        r = src[(rec["game_id"], rec["qtr"], rec["clock"], rec["desc"])]
        assert rec["wp_before"] == round(r["vegas_wp"], 4)
        assert rec["swing"] == round(r["vegas_wpa"], 4)
        assert rec["team"] == r["posteam"]


def test_top_swing_is_daniels_hail_mary(built):
    t = built["top"][0]
    assert (t["game_id"], t["team"], t["qtr"], t["play_type"]) == ("2024_08_CHI_WAS", "WAS", 4, "pass")
    assert "J.Daniels" in t["desc"] and t["swing"] > 0.8


def test_filter_drops_ot_kneels_bad_game_and_long_fg(built):
    for rec in _records(built):
        assert 1 <= rec["qtr"] <= 4
        assert rec["game_id"] != bs.BAD_GAME
        assert rec["play_type"] in bs.SWING_PLAY_TYPES
    descs = " ".join(r["desc"] for r in _records(built))
    assert "kneels" not in descs
    assert not bs.is_swing_candidate({**ROWS[0], "play_type": "field_goal", "kick_distance": 65})
    assert not bs.is_swing_candidate({**ROWS[0], "qtr": 5})
    assert not bs.is_swing_candidate({**ROWS[0], "qb_kneel": 1})
    assert not bs.is_swing_candidate({**ROWS[0], "vegas_wpa": None})


def test_each_week_is_its_biggest_swing(built):
    cands = [r for r in ROWS if bs.is_swing_candidate(r)]
    for key, rec in built["weeks"].items():
        best = max(abs(r["vegas_wpa"]) for r in cands if bs.week_key(r) == key)
        assert abs(rec["swing"]) == round(best, 4)
    tops = [abs(r["swing"]) for r in built["top"]]
    assert tops == sorted(tops, reverse=True)


def test_playoff_rounds(built):
    rounds = bs.post_round_map(ROWS)
    assert rounds[(2024, 19)] == "WC" and rounds[(2024, 22)] == "SB" and (2024, 8) not in rounds
    assert built["weeks"]["2024-w08"]["round"] is None


def test_frozen_weeks_fail_on_change(built):
    old = json.loads(bs.dumps(built))
    assert bs.check_frozen(old, built) == []
    k = next(iter(old["weeks"]))
    old["weeks"][k]["swing"] = 0.0
    assert bs.check_frozen(old, built) == [k]


def test_frozen_week_change_exits_nonzero(tmp_path, built, monkeypatch):
    out = tmp_path / "swings.json"
    old = json.loads(bs.dumps(built))
    k = next(iter(old["weeks"]))
    old["weeks"][k]["desc"] = "changed"
    out.write_text(json.dumps(old))
    monkeypatch.setattr(bs, "load_rows", lambda paths: ROWS)
    assert bs.main(["x.parquet", "--out", str(out)]) == 1
    assert json.loads(out.read_text())["weeks"][k]["desc"] == "changed"


def test_committed_site_file_is_small_and_clean():
    data = json.loads(SITE.read_text())
    assert SITE.stat().st_size < 100_000
    assert data["v"] == bs.SCHEMA_VERSION and len(data["top"]) == bs.TOP_N
    text = SITE.read_text()
    assert bs.BAD_GAME not in text
    assert not re.search(r"\b(EPA|WPA|xpass)\b", text)
    for rec in _records(data):
        assert set(rec) == RECORD_KEYS
        assert not any(BANNED_KEY.search(k) for k in rec if k != "yardline_100")
        assert 1 <= rec["qtr"] <= 4 and 0 <= rec["wp_before"] <= 1 and 0 <= rec["wp_after"] <= 1
        assert re.fullmatch(r"\d{2}:\d{2}", rec["clock"])
    for key, rec in data["weeks"].items():
        assert key == f"{rec['season']}-w{rec['week']:02d}"
