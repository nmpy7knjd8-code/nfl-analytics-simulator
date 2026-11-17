"""mining/build_comebacks.py (D1): winner's regulation low point, no OT win chance, bad rows dropped, frozen."""
from __future__ import annotations

import importlib.util
import json
import sys
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "mining"))
from seasons import size_cap  # noqa: E402
spec = importlib.util.spec_from_file_location("build_comebacks", ROOT / "mining/build_comebacks.py")
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)
FILE = ROOT / "data/site/comebacks.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|total_line|line", re.I)


def r(gid="2099_01_AAA_BBB", q=1, gsr=3600, wp=0.5, hs=20, as_=17, desc="x", t="15:00"):
    return {"game_id": gid, "season": 2099, "week": 1, "season_type": "REG", "game_date": "2099-09-01",
            "home_team": "BBB", "away_team": "AAA", "home_score": hs, "away_score": as_, "qtr": q, "time": t,
            "game_seconds_remaining": gsr, "vegas_home_wp": wp, "desc": desc}


def test_low_is_regulation_only_and_winner_side():
    rows = [r(), r(q=4, gsr=100, wp=0.02, t="01:40"), r(q=4, gsr=0, wp=0.5), r(q=5, gsr=0, wp=0.0001)]
    d = bc.build(rows)
    g = dict(zip(d["cols"], d["top"][0]))
    assert g["winner"] == "BBB" and g["low"] == 0.02 and g["low_qtr"] == 4 and g["ot"] is True
    away = bc.build([r(hs=10, as_=17), r(q=2, gsr=2000, wp=0.97)])  # away won: winner chance = 1 - home
    assert dict(zip(d["cols"], away["top"][0]))["low"] == 0.03
    assert bc.build([r(hs=17, as_=17)])["decided_games"] == 0  # ties left out


def test_bad_cin_buf_rows_dropped():
    g = "2019_03_CIN_BUF"
    rows = [r(gid=g), r(gid=g, q=2, gsr=1900, wp=0.001), r(gid=g, q=2, gsr=1800, wp=0.001, desc="End of half"),
            r(gid=g, q=3, gsr=1700, wp=0.4)]
    assert dict(zip(bc.COLS, bc.build(rows)["top"][0]))["low"] == 0.4


def test_committed_file():
    d = json.loads(FILE.read_text())
    assert d["decided_games"] == len(d["lows"]) == 1954 and d["lows"] == sorted(d["lows"])
    top = [dict(zip(d["cols"], t)) for t in d["top"]]
    assert [t["game_id"] for t in top[:3]] == ["2022_15_IND_MIN", "2022_19_LAC_JAX", "2022_02_NYJ_CLE"]
    assert all(1 <= t["low_qtr"] <= 4 and len(t["spark"]) == 24 for t in top)
    assert all(t["spark"][-1] == 100 for t in top if not t["ot"])
    assert sum(x < 0.05 for x in d["lows"]) == 65
    assert not [k for k in set(d) | set(d["cols"]) if BANNED.search(k)]
    assert FILE.stat().st_size < size_cap("data/site/comebacks.json")


def test_frozen():
    d = json.loads(FILE.read_text())
    assert bc.check_frozen(d, d) == []
    new = json.loads(json.dumps(d))
    new["top"][0][d["cols"].index("low")] = 0.5
    assert bc.check_frozen(d, new)


def test_spark_shows_the_low():
    d = json.loads(FILE.read_text())
    for e in d["top"]:
        g = dict(zip(d["cols"], e))
        assert len(g["spark"]) == d["spark_points"]
        assert min(g["spark"]) <= math.ceil(100 * g["low"]) + 1, g["game_id"]


def test_spark_low_between_samples():
    rows = [r(), r(q=2, gsr=2780, wp=0.6), r(q=2, gsr=2770, wp=0.01, t="11:10"), r(q=2, gsr=2760, wp=0.6), r(q=4, gsr=0, wp=0.6)]
    g = dict(zip(bc.COLS, bc.build(rows)["top"][0]))
    assert min(g["spark"]) == 1 and g["spark"][-1] == 100


def test_override_allows_only_spark():
    d = json.loads(FILE.read_text())
    gid = d["top"][0][3]
    new = json.loads(json.dumps(d)); new["top"][0][-1] = [0] * 24
    assert bc.check_frozen(d, new) and bc.check_frozen(d, new, {gid}) == []
    new["top"][0][9] = 0.5
    assert bc.check_frozen(d, new, {gid})


def test_spark_final_index_never_overwritten():
    # OT win whose regulation low (Q4 0:28) is nearest the last sample: the line keeps its end-of-regulation value.
    rows = [r(hs=13, as_=10), r(q=4, gsr=40, wp=0.4), r(q=4, gsr=28, wp=0.02, t="00:28"), r(q=4, gsr=0, wp=0.47),
            r(q=5, gsr=0, wp=0.9)]
    g = dict(zip(bc.COLS, bc.build(rows)["top"][0]))
    assert g["ot"] and g["spark"][-1] == 47 and g["spark"][-2] == 2
    rows = [r(), r(q=4, gsr=5, wp=0.03, t="00:05"), r(q=4, gsr=0, wp=0.6)]
    g = dict(zip(bc.COLS, bc.build(rows)["top"][0]))
    assert g["spark"][-1] == 100 and g["spark"][-2] == 3


def test_published_spark_ends_at_pre_override_value():
    d = json.loads(FILE.read_text())
    for e in d["top"]:
        g = dict(zip(d["cols"], e))
        if not g["ot"]:
            assert g["spark"][-1] == 100, g["game_id"]
    nyj = {e[3]: dict(zip(d["cols"], e)) for e in d["top"]}.get("2023_08_NYJ_NYG")
    if nyj:
        assert nyj["spark"][-1] == 47
