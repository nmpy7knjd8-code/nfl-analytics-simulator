"""mining/build_onthisday.py (G4): every one of 366 days resolves, nearest-date fallback, nflverse finals."""
from __future__ import annotations

import importlib.util
import json
import sys
import re
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "mining"))
from seasons import size_cap  # noqa: E402
spec = importlib.util.spec_from_file_location("build_onthisday", ROOT / "mining/build_onthisday.py")
bo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bo)
FILE = ROOT / "data/site/onthisday.json"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|line|wp", re.I)


def g(gid, d, a=10, h=20, ot=False):
    s, w, aw, hm = gid.split("_")
    return {"game_id": gid, "season": int(s), "week": int(w), "season_type": "REG", "game_date": d,
            "home_team": hm, "away_team": aw, "home_score": h, "away_score": a, "ot": ot}


def test_fallback_nearest_and_earlier_on_tie():
    d = bo.build([g("2099_01_A_B", "2099-09-10"), g("2099_02_C_D", "2099-09-14"), g("2099_03_E_F", "2100-01-02")])
    assert d["days"]["09-10"] == [["2099_01_A_B", 2099, 10, 20, False]]
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
    assert FILE.stat().st_size < size_cap("data/site/onthisday.json")


def test_frozen():
    d = json.loads(FILE.read_text())
    assert bo.check_frozen(d, d) == []
    new = json.loads(json.dumps(d))
    new["days"]["10-26"][0][2] += 1
    assert bo.check_frozen(d, new)


def test_ot_column():
    d = bo.build([g("2099_01_A_B", "2099-09-10", ot=True)])
    assert d["cols"][-1] == "ot" and d["days"]["09-10"][0][-1] is True
    f = json.loads(FILE.read_text())
    rows = {r[0]: r for rs in f["days"].values() for r in rs}
    assert f["cols"] == ["game_id", "year", "away_score", "home_score", "ot"]
    assert all(len(r) == 5 and isinstance(r[4], bool) for r in rows.values())
    assert rows["2024_09_TB_KC"] == ["2024_09_TB_KC", 2024, 24, 30, True]
    assert sum(r[4] for r in rows.values()) == 110


def test_ot_append_only_guard():
    new = json.loads(FILE.read_text())
    old = bo.strip_ot(new)
    assert bo.check_frozen(old, new) == []  # append allowed by the override
    bad = json.loads(json.dumps(new))
    bad["days"]["10-26"][0][2] += 1
    assert bo.check_frozen(old, bad)  # existing values still frozen
    extra = {**new, "cols": new["cols"] + ["x"]}
    assert bo.check_frozen(old, extra) == ["cols"]
    o = json.loads(bo.OT_OVERRIDE.read_text())
    assert o["file"] == "data/site/onthisday.json" and o["rule"] == "ot_append" and o["approved_by"]


def test_frontend_copy_identical():
    assert (ROOT / "frontend/public/data/stories/onthisday.json").read_bytes() == FILE.read_bytes()
