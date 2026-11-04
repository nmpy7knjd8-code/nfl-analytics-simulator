"""mining/build_team_garbage_time.py: F3 teamGarbageTime.json (all vs close views, REG, frozen numbers)."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_team_garbage_time", ROOT / "mining/build_team_garbage_time.py")
gt = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gt)

SITE = ROOT / "frontend/lib/teamGarbageTime.json"
REDZONE = ROOT / "frontend/lib/teamRedzone.json"
BANNED_KEY = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds|wp", re.I)


def row(drive, yl, wp, qtr=1, team="KC", play_type="pass", result="Touchdown", down=1, yards=5, conv=0,
        season=2024, season_type="REG", game="g1"):
    return {"game_id": game, "season": season, "season_type": season_type, "posteam": team, "fixed_drive": drive,
            "fixed_drive_result": result, "yardline_100": yl, "play_type": play_type, "qtr": qtr, "vegas_wp": wp,
            "down": down, "yards_gained": yards, "third_down_converted": conv}


ROWS = [
    row(1, 15, 0.50), row(1, 5, 0.95),                               # close trip (first RZ snap 50%), TD
    row(2, 12, 0.97, result="Field goal", down=3, conv=1),           # garbage trip; 3rd-down conv not close
    row(3, 18, 0.40, qtr=5, result="Touchdown", down=3, yards=-2),   # OT: never close
    row(4, 50, 0.30, down=3, conv=1, yards=10),                      # close 3rd-down conversion
    row(4, 8, 0.30, play_type="extra_point"),                        # not a snap/play
    row(1, 10, 0.5, season_type="POST", game="g2"),                  # playoffs excluded
]


def kc(view):
    return next(t for t in view["teams"] if t["team"] == "KC")


def test_views_count_nflverse_fields():
    out = gt.build(ROWS)
    a, c = kc(out["all"]), kc(out["close"])
    assert a["rz"][:2] == [3, 2] and a["ypp"][:2] == [5, 23] and a["third"][:2] == [3, 2]
    assert c["rz"][:2] == [1, 1] and c["ypp"][:2] == [2, 15] and c["third"][:2] == [1, 1]
    assert out["close"]["league"]["rz"] == [1, 1, 1.0]
    assert out["by_season"]["2024"]["all"] == out["all"] and out["season_type"] == "REG"


def test_overtime_never_close_and_ranks_per_view():
    out = gt.build(ROWS + [row(9, 10, 0.5, team="BUF", result="Punt")])
    assert kc(out["close"])["rz"][2] == 1
    buf = next(t for t in out["close"]["teams"] if t["team"] == "BUF")
    assert buf["rz"][:2] == [1, 0] and buf["rz"][2] == 2  # rank is per view, ties share the better rank
    assert gt.is_close(row(1, 10, 0.5, qtr=5)) is False and gt.is_close(row(1, 10, 0.1)) and gt.is_close(row(1, 10, 0.9))


def test_frozen_numbers():
    old = gt.build(ROWS)
    assert gt.check_frozen(old, gt.build(ROWS)) == []
    bad = gt.check_frozen(old, gt.build([r for r in ROWS if r["fixed_drive"] != 4]))
    assert "2024:close:KC" in bad and "all:all:KC" in bad
    later = gt.build(ROWS + [row(1, 10, 0.5, season=2025, game="g3")])
    assert gt.check_frozen(old, later) == []


def test_site_file_matches_redzone_and_is_clean():
    site, redz = json.loads(SITE.read_text()), json.loads(REDZONE.read_text())
    assert site["stub"] is False and site["season_list"] == list(range(2019, 2026))
    assert {t["team"]: t["rz"][:2] for t in site["all"]["teams"]} == {t["team"]: [t["drives"], t["td"]] for t in redz["teams"]}
    for y, s in redz["by_season"].items():
        assert {t["team"]: t["rz"][:2] for t in site["by_season"][y]["all"]["teams"]} == \
            {t["team"]: [t["drives"], t["td"]] for t in s["teams"]}
    for v in ("all", "close"):
        assert len(site[v]["teams"]) == 32
        for s in gt.STATS:
            assert site[v]["league"][s][0] == sum(t[s][0] for t in site[v]["teams"])
    keys: set[str] = set()

    def walk(o):
        if isinstance(o, dict):
            keys.update(o)
            [walk(v) for v in o.values()]
        elif isinstance(o, list):
            [walk(v) for v in o]
    walk(site)
    assert not [k for k in keys if BANNED_KEY.search(k)]
    assert SITE.stat().st_size < 60_000
