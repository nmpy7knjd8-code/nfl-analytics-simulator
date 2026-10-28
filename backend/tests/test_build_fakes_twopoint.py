"""mining/build_fakes.py (B2) and mining/build_twopoint.py (B1): nflverse-exact counts, no OT win chance,
banned fields, frozen guard."""
from __future__ import annotations

import importlib.util
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "mining"))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"mining/{name}.py")
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


bf, bt = _load("build_fakes"), _load("build_twopoint")
FAKES, TWO = ROOT / "data/site/fakes.json", ROOT / "data/site/twopoint.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|total_line", re.I)


def prow(**k):
    base = {"game_id": "2024_01_KC_BAL", "season": 2024, "week": 1, "season_type": "REG", "posteam": "KC",
            "defteam": "BAL", "qtr": 2, "time": "05:00", "down": 4, "ydstogo": 3, "yardline_100": 60,
            "play_type": "run", "desc": "(Punt formation) Direct snap to X up the middle for 5 yards.",
            "first_down": 1, "vegas_wp": 0.61234, "posteam_score": 7, "defteam_score": 3}
    return {**base, **k}


def test_fake_filter_and_values():
    rows = [prow(), prow(time="04:00", play_type="punt", desc="(Punt formation) X punts 45 yards."),
            prow(time="03:00", down=3), prow(time="02:00", desc="(Shotgun) pass"),
            prow(time="01:00", qtr=5, play_type="pass", first_down=0, desc="(Punt formation) X pass incomplete")]
    out = bf.build(rows)
    assert out["count"] == 2 and out["first_downs"] == 1 and out["first_down_rate"] == 0.5
    reg, ot = out["plays"]
    assert reg["wp"] == round(0.61234, 4) and reg["togo"] == 3 and reg["kind"] == "run"
    assert ot["qtr"] == 5 and ot["wp"] is None


def test_fake_frozen():
    old = bf.build([prow()])
    assert bf.check_frozen(old, bf.build([prow()])) == []
    assert bf.check_frozen(old, bf.build([prow(first_down=0)]))
    assert bf.check_frozen(old, bf.build([prow(), prow(season=2025, game_id="2025_01_KC_BAL")])) == []


def trow(**k):
    base = {"game_id": "g", "season": 2024, "week": 1, "season_type": "REG", "posteam": "KC", "defteam": "BAL",
            "qtr": 4, "time": "02:00", "play_type": "pass", "two_point_attempt": 1,
            "two_point_conv_result": "success", "extra_point_result": None, "score_differential": -2, "vegas_wp": 0.3}
    return {**base, **k}


def test_twopoint_rates_and_ot():
    rows = [trow(), trow(time="01:00", play_type="run", two_point_conv_result="failure"),
            trow(time="00:30", play_type="no_play"), trow(qtr=5, time="05:00"),
            trow(two_point_attempt=0, play_type="extra_point", extra_point_result="good", time="09:00"),
            trow(two_point_attempt=0, play_type="extra_point", extra_point_result="blocked", time="08:00")]
    out = bt.build(rows)
    assert out["two_point"]["tries"] == 4 and out["two_point"]["made"] == 3
    assert out["two_point"]["run"] == {"tries": 1, "made": 0, "rate": 0.0}
    assert out["extra_point"] == {"tries": 2, "made": 1, "rate": 0.5}
    assert len(out["tries"]) == 3 and all(t[out["cols"].index("qtr")] <= 4 for t in out["tries"])
    assert out["per_choice_win_chance"] is None
    assert bt.check_frozen(out, bt.build(rows)) == []
    assert bt.check_frozen(out, bt.build([trow(vegas_wp=0.31)] + rows[1:]))


def test_committed_files():
    f, t = json.loads(FAKES.read_text()), json.loads(TWO.read_text())
    assert f["count"] == 162 == len(f["plays"]) and f["first_downs"] == 90
    assert sum(f["by_season"].values()) == 162 and f["by_season"]["2019"] == 28 and f["by_season"]["2025"] == 12
    assert t["two_point"]["tries"] == 960 and t["two_point"]["made"] == 456
    assert (t["two_point"]["run"]["tries"], t["two_point"]["pass"]["tries"]) == (266, 681)
    assert t["extra_point"] == {"tries": 9119, "made": 8606, "rate": 0.9437}
    assert t["two_point"]["run"]["made"] == 145 and t["two_point"]["pass"]["made"] == 301
    assert t["per_choice_win_chance"] is None
    qi = t["cols"].index("qtr")
    assert len(t["tries"]) == 957 and all(r[qi] <= 4 for r in t["tries"])
    assert all(p["wp"] is None or p["qtr"] <= 4 for p in f["plays"])
    d = f["real_punts"]
    assert 290 <= len(d) <= 300 and all(p["first_down"] is None and p["qtr"] <= 4 and p["kind"] == "punt" for p in d)
    assert set(d[0]) == set(f["plays"][0]) and f["punt_count"] > len(d)
    assert not {bf.key(p) for p in d} & {bf.key(p) for p in f["plays"]}
    keys = set(f) | {k for p in f["plays"] for k in p} | set(t) | set(t["cols"])
    assert not [k for k in keys if BANNED.search(k)]
    assert FAKES.stat().st_size < 180_000 and TWO.stat().st_size < 80_000


def test_decoys_stratified_deterministic_and_frozen():
    fakes = [bf.record(prow(time=f"0{i}:00", ydstogo=1 + i % 2)) for i in range(4)]
    punts = [{**bf.record(prow(time=f"{10 + i}:00", ydstogo=1 + i % 2, play_type="punt")), "first_down": None}
             for i in range(40)]
    a, b = bf.sample_decoys(fakes, punts, n=10), bf.sample_decoys(fakes, list(reversed(punts)), n=10)
    assert a == b and len(a) == 10
    assert sum(p["togo"] == 1 for p in a) == 5
    rows = [prow(), prow(time="09:00", play_type="punt", desc="X punts"), prow(time="08:00", play_type="punt", desc="Y punts")]
    old = bf.build(rows)
    assert len(old["real_punts"]) == 2 and old["real_punts"][0]["first_down"] is None and old["punt_count"] == 2
    gone = {**old, "real_punts": [{**old["real_punts"][0], "clock": "00:01"}]}
    assert bf.check_frozen(gone, bf.build(rows))
