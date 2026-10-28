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
    w = t["per_choice_win_chance"]
    assert w["cols"] == ["go", "kick"] and set(w["by_try"]) == {bt.wc_key(dict(zip(t["cols"], r))) for r in t["tries"]}
    assert w["go_rate"] == t["two_point"]["rate"] and 0.9 < w["kick_rate"] < 0.97
    assert all(v is None or (len(v) == 2 and all(0 <= x <= 1 for x in v)) for v in w["by_try"].values())
    qi = t["cols"].index("qtr")
    assert len(t["tries"]) == 957 and all(r[qi] <= 4 for r in t["tries"])
    assert all(p["wp"] is None or p["qtr"] <= 4 for p in f["plays"])
    d = f["real_punts"]
    assert 290 <= len(d) <= 300 and all(p["first_down"] is None and p["qtr"] <= 4 and p["kind"] == "punt" for p in d)
    assert set(d[0]) == set(f["plays"][0]) and f["punt_count"] > len(d)
    assert not {bf.key(p) for p in d} & {bf.key(p) for p in f["plays"]}
    keys = set(f) | {k for p in f["plays"] for k in p} | set(t) | set(t["cols"])
    assert not [k for k in keys if BANNED.search(k)]
    assert FAKES.stat().st_size < 180_000 and TWO.stat().st_size < 140_000


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


def _try(**k):
    base = {"season": 2024, "week": 1, "season_type": "REG", "game_id": "2024_01_KC_BAL", "team": "KC", "opp": "BAL",
            "qtr": 4, "clock": "05:00", "diff": -2, "kind": "pass", "made": 1, "wp": 0.3}
    return [{**base, **k}[c] for c in base]


def test_fill_win_chance_expected_values_and_ot_null():
    cols = ["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made", "wp"]
    doc = {"cols": cols, "tries": [_try(), _try(qtr=5, clock="08:00"), _try(qtr=2, clock="03:00"),
                                   _try(clock="00:00", diff=-1)]}
    seen = []

    def wp(row):  # receiving team's win chance: a pure function of its score margin
        seen.append(row)
        return {-1: 0.2, 0: 0.5, 1: 0.8, 2: 0.9, 3: 0.95}[row["score_differential"]]

    out = bt.fill_win_chance(doc, wp, 0.5, 0.9, {"method": "t"})
    by = out["by_try"]
    k = [bt.wc_key(dict(zip(cols, r))) for r in doc["tries"]]
    # down 2 after the TD: miss -> 1-0.9=0.1, PAT -> 1-0.8=0.2, two -> 1-0.5=0.5
    assert by[k[0]] == [round(0.5 * 0.5 + 0.5 * 0.1, 4), round(0.9 * 0.2 + 0.1 * 0.1, 4)]
    assert by[k[1]] is None  # overtime: no win chance
    assert by[k[3]] == [round(0.5 * 1 + 0.5 * 0, 4), round(0.9 * 0.5, 4)]  # regulation over: known result
    first = [r for r in seen if r["qtr"] == 2]
    assert {r["receive_2h_ko"] for r in first} == {0, 1}  # unknown 2H receiver averaged
    r0 = seen[0]
    assert r0["posteam"] == "H" and r0["yardline_100"] == 75 and r0["game_seconds_remaining"] == 300
    assert out["go_rate"] == 0.5 and out["kick_rate"] == 0.9 and out["cols"] == ["go", "kick"]
    assert doc["tries"][0] == _try()  # tries untouched


def test_late_q4_null_and_end_of_regulation():
    cols = ["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made", "wp"]
    late = [_try(clock="00:02", diff=1), _try(clock="00:05", diff=0), _try(clock="02:00", diff=-2)]  # up 1 TD at 0:02, tied
    ends = [_try(clock="00:00", diff=d, game_id=f"2024_0{i}_KC_BAL") for i, d in enumerate((1, 0, -1), 1)]
    doc = {"cols": cols, "tries": late + ends + [_try(clock="02:01")]}
    by = bt.fill_win_chance(doc, lambda r: 0.4, 0.475, 0.93, {"method": "t"})
    v = [by["by_try"][bt.wc_key(dict(zip(cols, r)))] for r in doc["tries"]]
    assert v[:3] == [None, None, None] and "2:00" in by["null_reason"]
    assert v[3][1] >= 0.95  # up 1 at the end: kick wins
    assert v[4] == [round(0.475 + 0.525 * 0.5, 4), round(0.93 + 0.07 * 0.5, 4)]  # tied: a miss -> OT 0.5
    assert v[5][1] == round(0.93 * 0.5, 4) and 0.4 < v[5][1] < 0.5  # down 1: PAT ties (coin-flip OT)
    assert v[6] is not None


def test_committed_late_q4_is_null():
    t = json.loads(TWO.read_text())
    by = t["per_choice_win_chance"]["by_try"]
    for r in t["tries"]:
        x = dict(zip(t["cols"], r))
        s = bt._clock_secs(x["clock"])
        assert (by[bt.wc_key(x)] is None) == (x["qtr"] == 4 and 0 < s <= 120)
