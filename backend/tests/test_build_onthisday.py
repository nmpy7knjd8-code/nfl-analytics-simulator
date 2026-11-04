"""mining/build_onthisday.py (G4): every one of 366 days resolves, nearest-date fallback, nflverse finals."""
from __future__ import annotations

import importlib.util
import json
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_onthisday", ROOT / "mining/build_onthisday.py")
bo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bo)
FILE = ROOT / "data/site/onthisday.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|line|wp", re.I)


def g(gid, d, a=10, h=20):
    s, w, aw, hm = gid.split("_")
    return {"game_id": gid, "season": int(s), "week": int(w), "season_type": "REG", "game_date": d,
            "home_team": hm, "away_team": aw, "home_score": h, "away_score": a}


def test_fallback_nearest_and_earlier_on_tie():
    d = bo.build([g("2099_01_A_B", "2099-09-10"), g("2099_02_C_D", "2099-09-14"), g("2099_03_E_F", "2100-01-02")])
    assert d["days"]["09-10"] == [["2099_01_A_B", 2099, 10, 20]]
    assert d["fallback"]["09-12"] == -2  # tie (10th vs 14th) goes to the earlier day
    assert d["fallback"]["09-13"] == 1
    assert d["fallback"]["12-31"] == 2  # circular across New Year
    assert len(d["days"]) + len(d["fallback"]) == 366


def test_suspended_game_left_out():
    d = bo.build([g("2022_17_BUF_CIN", "2023-01-02"), g("2099_01_A_B", "2099-09-10")])
    assert list(d["days"]) == ["09-10"]


def test_committed_file():
    d = json.loads(FILE.read_text())
    assert set(d["days"]) | set(d["fallback"]) == {(date(2024, 1, 1) + timedelta(i)).strftime("%m-%d")
                                                   for i in range(366)}
    assert not set(d["days"]) & set(d["fallback"])
    assert len(d["days"]) == 155 and len(d["days"]["10-26"]) == 13
    assert sum(map(len, d["days"].values())) == 1960
    for k, off in d["fallback"].items():
        t = (date(2024, *map(int, k.split("-"))) + timedelta(off)).strftime("%m-%d")
        assert t in d["days"] and off != 0
    assert not [k for k in set(d) | set(d["cols"]) if BANNED.search(k)]
    assert FILE.stat().st_size < 80_000


def test_frozen():
    d = json.loads(FILE.read_text())
    assert bo.check_frozen(d, d) == []
    new = json.loads(json.dumps(d))
    new["days"]["10-26"][0][2] += 1
    assert bo.check_frozen(d, new)
