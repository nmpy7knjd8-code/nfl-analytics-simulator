"""mining/build_weather.py (G6): open-air games only, nflverse weather, band numbers match the spec."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_weather", ROOT / "mining/build_weather.py")
bw = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bw)
FILE = ROOT / "data/site/weather.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|line|wp", re.I)


def g(gid, roof="outdoors", temp=40, wind=12, h=20, a=10):
    return {"game_id": gid, "game_date": "2099-09-10", "roof": roof, "temp": temp, "wind": wind,
            "home_score": h, "away_score": a}


def test_dome_closed_missing_have_no_weather():
    d = bw.build([g("2099_01_A_B"), g("2099_01_C_D", roof="dome", temp=None, wind=None),
                  g("2099_01_E_F", roof="closed"), g("2099_01_G_H", wind=None), g("2099_01_I_J", roof="open"),
                  g("2022_17_BUF_CIN")])
    assert d["games"] == {"2099_01_A_B": [12, 40], "2099_01_I_J": [12, 40]}
    assert d["bands"]["wind"][1] == {"mph": [10, 14], "games": 2, "avg_points": 30.0}


def test_committed_file_matches_spec_bands():
    d = json.loads(FILE.read_text())
    assert len(d["games"]) == 1199
    w = {tuple(b["mph"]): (b["games"], b["avg_points"]) for b in d["bands"]["wind"]}
    assert w[(0, 9)] == (773, 45.9) and w[(10, 14)] == (282, 42.7) and w[(15, 19)] == (112, 42.3)
    t = {tuple(b["f"]): (b["games"], b["avg_points"]) for b in d["bands"]["temp"]}
    assert t[(None, 32)] == (88, 44.7) and t[(33, 50)] == (347, 42.9)
    assert sum(b["games"] for b in d["bands"]["wind"]) == 1199
    assert not [k for k in set(d) | set(d["cols"]) if BANNED.search(k)]
    assert FILE.stat().st_size < 40_000


def test_frozen():
    d = json.loads(FILE.read_text())
    assert bw.check_frozen(d, d) == []
    new = json.loads(json.dumps(d))
    gid = next(iter(new["games"]))
    new["games"][gid] = [99, 99]
    assert bw.check_frozen(d, new) == [gid]


def test_indoors_lists_dome_and_closed_only():
    import json as _j
    from pathlib import Path as _P
    d = _j.loads((_P(__file__).resolve().parents[2] / "data/site/weather.json").read_text())
    assert d["indoors"] and not set(d["indoors"]) & set(d["games"])
    assert d["indoors"] == sorted(d["indoors"])
