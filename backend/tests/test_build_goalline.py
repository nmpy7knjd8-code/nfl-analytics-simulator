"""mining/build_goalline.py (C4): 4th-and-goal-at-the-1 stops, spec numbers, no ids or win chance, frozen."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_goalline", ROOT / "mining/build_goalline.py")
bg = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bg)
FILE = ROOT / "data/site/goalline.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|line\b|wp", re.I)


def r(**k):
    base = {"game_id": "2099_01_AAA_BBB", "season": 2099, "week": 1, "season_type": "REG", "game_date": "2099-09-10",
            "posteam": "AAA", "defteam": "BBB", "down": 4, "yardline_100": 1, "play_type": "run", "touchdown": 0,
            "qtr": 2, "time": "01:00"}
    return {**base, **k}


def test_rule():
    d = bg.build([r(), r(touchdown=1, time="02:00"), r(play_type="field_goal", time="03:00"),
                  r(play_type="no_play", time="04:00"), r(yardline_100=2, time="05:00"), r(down=3, time="06:00")])
    assert len(d["stops"]) == 1 and d["rates"]["chances"] == 3 and d["rates"]["went"] == 2


def test_committed_file_matches_spec():
    d = json.loads(FILE.read_text())
    rt = d["rates"]
    assert (rt["chances"], rt["went"], rt["scored"]) == (255, 229, 129) and len(d["stops"]) == 100
    assert (rt["run"]["tries"], rt["run"]["rate"], rt["pass"]["tries"], rt["pass"]["rate"]) == (139, 0.6115, 90, 0.4889)
    assert not [k for k in set(d) | set(d["cols"]) | set(rt) if BANNED.search(k)]
    keys = [(s[3], s[6], s[7], s[4]) for s in d["stops"]]
    assert len(set(keys)) == 100
    assert bg.check_frozen(d, d) == []
