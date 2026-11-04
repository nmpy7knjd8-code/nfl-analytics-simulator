"""mining/build_drives.py (F7): drive strips from nflverse play outcomes (no EPA), bad rows dropped, frozen."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_drives", ROOT / "mining/build_drives.py")
bd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bd)
DIR = ROOT / "data/site/drives"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|line|wp", re.I)


def r(d=1, pt="run", gid="2099_01_AAA_BBB", **k):
    base = {"game_id": gid, "season": 2099, "week": 1, "season_type": "REG", "game_date": "2099-09-10",
            "home_team": "BBB", "away_team": "AAA", "fixed_drive": d, "fixed_drive_result": "Touchdown",
            "posteam": "AAA", "play_type": pt, "drive_quarter_start": 1, "drive_game_clock_start": "15:00",
            "ydsnet": 75, "yards_gained": 3, "first_down": 0, "touchdown": 0, "td_team": None, "interception": 0,
            "fumble_lost": 0, "desc": "x"}
    return {**base, **k}


def test_tiles_from_play_outcomes():
    rows = [r(pt="kickoff", posteam="BBB"), r(), r(yards_gained=0), r(first_down=1, pt="pass"),
            r(pt="no_play"), r(touchdown=1, td_team="AAA", first_down=1),
            r(d=2, posteam="BBB", fixed_drive_result="Turnover", pt="pass", interception=1, ydsnet=-2),
            r(d=3, posteam="AAA", fixed_drive_result="Punt", pt="punt", ydsnet=0)]
    g = bd.build(rows)[2099]["games"]["2099_01_AAA_BBB"]
    assert g == ["AAA 1 15:00 75 TD GNFT", "BBB 1 15:00 -2 TO X", "AAA 1 15:00 0 P K"]


def test_bad_cin_buf_rows_dropped():
    g = "2019_03_CIN_BUF"
    rows = [r(gid=g), r(gid=g, pt="pass", first_down=1), r(gid=g, pt=None, desc="End of half"), r(gid=g)]
    assert bd.build(rows)[2099]["games"][g] == ["AAA 1 15:00 75 TD GG"]


def test_committed_files():
    n = 0
    for f in sorted(DIR.glob("*.json")):
        d = json.loads(f.read_text())
        assert d["schema"] == "drives/v1" and f.stat().st_size < 180_000
        assert not [k for k in set(d) | set(d["cols"]) if BANNED.search(k)]
        for gid, drives in d["games"].items():
            assert gid != "2022_17_BUF_CIN" and drives
            for s in drives:
                team, q, clock, yards, res, tiles = s.split(" ")
                assert res in d["result_key"] and set(tiles) <= set(d["tile_key"]) and tiles
        n += len(d["games"])
    assert n == 1960


def test_frozen():
    d = json.loads((DIR / "2024.json").read_text())
    assert bd.check_frozen(d, d) == []
    new = json.loads(json.dumps(d))
    gid = next(iter(new["games"]))
    new["games"][gid] = new["games"][gid][1:]
    assert bd.check_frozen(d, new) == [gid]
