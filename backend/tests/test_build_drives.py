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


def test_two_point_try_is_not_a_snap():
    rows = [r(touchdown=1, td_team="AAA"), r(two_point_attempt=1, yards_gained=2),
            r(d=2, pt="kickoff", posteam="BBB"), r(d=2, posteam="BBB", two_point_attempt=1, ydsnet=0)]
    assert bd.build(rows)[2099]["games"]["2099_01_AAA_BBB"] == ["AAA 1 15:00 75 TD T"]


def test_return_td_drive_without_snaps_gone():
    d = json.loads((DIR / "2024.json").read_text())["games"]["2024_01_ARI_BUF"]
    assert not [s for s in d if s.startswith("ARI 4 08:44")]
    assert "BUF 4 13:32 70 TD GFGNGFNFNT" in d


def test_two_point_override_scope():
    o = json.loads((ROOT / "mining/frozen_overrides/drives-2026-11-03-two-point.json").read_text())
    assert len(o["games"]) == 703 == len(set(o["games"]))
    old = ["AAA 1 15:00 75 TD GFTG", "BBB 1 10:00 0 TD G", "BBB 2 09:00 -5 OT NXG", "AAA 2 05:00 3 P GK"]
    good = ["AAA 1 15:00 75 TD GFT", "BBB 2 09:00 -5 OT NX", "AAA 2 05:00 3 P GK"]
    assert bd.two_point_fix_ok(old, good)
    assert not bd.two_point_fix_ok(old, ["AAA 1 15:00 75 TD GF", *good[1:]])
    assert not bd.two_point_fix_ok(old, [good[0], good[1], "AAA 2 05:00 3 P G"])
    assert not bd.two_point_fix_ok(old, [good[0], "BBB 2 09:00 -6 OT NX", good[2]])
    assert not bd.two_point_fix_ok(["AAA 1 15:00 75 P GK"], [])
    base = {"schema": "drives/v1", "cols": [], "games": {"g": old, "h": old}}
    new = {"schema": "drives/v1", "cols": [], "games": {"g": good, "h": good}}
    assert bd.check_frozen(base, new, {"g"}) == ["h"]
    assert bd.check_frozen(base, base, {"g"}) == ["g (override: not exactly the two_point change)"]


def test_od_rename_override_scope():
    o = json.loads((ROOT / "mining/frozen_overrides/drives-2026-11-03-od-rename.json").read_text())
    assert o["rule"] == "od_rename" and len(o["games"]) == 425 == len(set(o["games"]))
    old = ["AAA 1 15:00 -5 OT NX", "BBB 1 14:50 0 TD T", "AAA 5 10:00 3 P GK"]
    new = ["AAA 1 15:00 -5 OD NX", "BBB 1 14:50 0 TD T", "AAA 5 10:00 3 P GK"]
    assert bd.od_rename_ok(old, new)
    assert not bd.od_rename_ok(old, ["AAA 1 15:00 -5 OD N", *new[1:]])
    assert not bd.od_rename_ok(old, [new[0], "BBB 1 14:50 0 OD T", new[2]])
    rk_o, rk_n = {"OT": "Opponent touchdown", "P": "Punt"}, {"OD": "Opponent touchdown", "P": "Punt"}
    base = {"schema": "drives/v1", "cols": [], "result_key": rk_o, "games": {"g": old, "h": old}}
    nxt = {"schema": "drives/v1", "cols": [], "result_key": rk_n, "games": {"g": new, "h": new}}
    assert bd.check_frozen(base, nxt, {"g", "h"}, "od_rename") == []
    assert bd.check_frozen(base, nxt, {"g"}, "od_rename") == ["h"]
    assert bd.check_frozen(base, nxt, {"g", "h"}, "two_point")[-1] == "result_key"


def test_no_ot_result_code_left():
    for f in DIR.glob("*.json"):
        d = json.loads(f.read_text())
        assert "OT" not in d["result_key"] and d["result_key"]["OD"] == "Opponent touchdown"
        assert not [s for v in d["games"].values() for s in v if s.split(" ")[4] == "OT"]


def test_ydsnet_picks_candidate_matching_yardlines():
    rows = [r(pt="kickoff", posteam="BBB", drive=4, ydsnet=13), r(drive=4, ydsnet=13, yardline_100=75, yards_gained=-2),
            r(drive=3, ydsnet=-2, yardline_100=77, yards_gained=0), r(pt="punt", drive=3, ydsnet=-2, yardline_100=77,
                                                                     yards_gained=0, fixed_drive_result="Punt")]
    assert bd.build(rows)[2099]["games"]["2099_01_AAA_BBB"][0].split(" ")[3] == "-2"
    assert bd.drive_ydsnet([r(ydsnet=75)]) == 75


def test_ydsnet_override_scope():
    o = json.loads((ROOT / "mining/frozen_overrides/drives-2026-11-03-ydsnet.json").read_text())
    assert o["rule"] == "ydsnet" and len(o["games"]) == 11 == len(set(o["games"]))
    old = ["AAA 1 15:00 13 P NNNK", "BBB 1 10:00 5 TD GT"]
    assert bd.ydsnet_fix_ok(old, ["AAA 1 15:00 -2 P NNNK", old[1]])
    assert not bd.ydsnet_fix_ok(old, old)
    assert not bd.ydsnet_fix_ok(old, ["AAA 1 15:00 -2 FG NNNK", old[1]])
    assert not bd.ydsnet_fix_ok(old, ["AAA 1 15:00 -2 P NNK", old[1]])
    d = {k: json.loads((DIR / f"{k}.json").read_text())["games"] for k in ("2021", "2020")}
    assert "JAX 2 14:43 -2 P NNNK" in d["2021"]["2021_02_DEN_JAX"]
    assert [s for s in d["2020"]["2020_09_CAR_KC"] if s.startswith("KC 4 07:40")][0].split(" ")[3] == "39"
