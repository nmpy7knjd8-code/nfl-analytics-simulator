"""mining/build_firstdown.py (G1): eligibility rule, yards-only outcomes, no EPA/ids/win chance, frozen."""
from __future__ import annotations

import importlib.util
import json
import sys
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "mining"))
from seasons import size_cap  # noqa: E402
spec = importlib.util.spec_from_file_location("build_firstdown", ROOT / "mining/build_firstdown.py")
bf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bf)
FILE = ROOT / "data/site/firstdown.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|success|wp\b|win", re.I)


def r(**k):
    base = {"game_id": "2099_01_AAA_BBB", "season": 2099, "week": 1, "season_type": "REG", "game_date": "2099-09-10",
            "qtr": 1, "time": "10:00", "down": 1, "ydstogo": 10, "yardline_100": 75, "play_type": "run",
            "yards_gained": 4, "posteam": "AAA", "defteam": "BBB", "posteam_score": 0, "defteam_score": 8}
    return {**base, **k}


def test_rule_and_good():
    rows = [r(), r(time="09:00", defteam_score=9), r(time="08:00", qtr=5), r(time="07:00", ydstogo=5),
            r(time="06:00", penalty=1), r(time="05:00", season_type="POST"), r(time="04:00", play_type="no_play"),
            r(time="03:00", play_type="pass", yards_gained=0, incomplete_pass=1)]
    d = bf.build(rows)
    assert d["eligible"] == 2 and d["league"]["run"]["good"] == 1.0 and d["league"]["pass"]["good"] == 0.0
    assert bf.good(r(yards_gained=12, interception=1)) is False


def test_committed_file():
    d = json.loads(FILE.read_text())
    assert d["eligible"] == 58737 and len(d["plays"]) == 520 and FILE.stat().st_size < size_cap("data/site/firstdown.json")
    assert len({(p[2], p[5], p[6], p[3]) for p in d["plays"]}) == 520
    assert all(abs(p[8] - p[9]) <= 8 and p[10] in ("pass", "run") for p in d["plays"])
    assert not [k for k in set(d) | set(d["cols"]) | set(d["league"]["pass"]) if BANNED.search(k)]
    assert bf.check_frozen(d, d) == []
