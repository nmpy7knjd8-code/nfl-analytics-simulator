"""mining/build_qb_profiles.py: G5 qbIndex.json + public/data/players/<id>.json."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_qb_profiles", ROOT / "mining/build_qb_profiles.py")
qp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(qp)

INDEX = ROOT / "frontend/lib/qbIndex.json"
PDIR = ROOT / "frontend/public/data/players"
BANNED = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds", re.I)
QA, QB = "00-0000001", "00-0000002"


def r(pid, wp, home_wp_next, qtr=1, play_type="pass", passer=QA, rusher=None, sack=0, scr=0, st="REG", game="2024_01_KC_BUF"):
    return [
        {"game_id": game, "season": 2024, "week": 1, "season_type": st, "home_team": "BUF", "away_team": "KC",
         "posteam": "BUF", "defteam": "KC", "qtr": qtr, "time": "10:00", "down": 1, "ydstogo": 10, "yardline_100": 50,
         "play_type": play_type, "desc": "x", "qb_kneel": 0, "qb_spike": 0, "kick_distance": None, "vegas_wp": wp,
         "vegas_wpa": 0, "vegas_home_wp": wp, "home_score": 20, "away_score": 10, "play_id": pid,
         "passer_player_id": passer, "rusher_player_id": rusher, "sack": sack, "qb_scramble": scr, "game_date": "2024-09-08"},
        {"game_id": game, "season": 2024, "week": 1, "season_type": st, "home_team": "BUF", "away_team": "KC",
         "posteam": "BUF", "defteam": "KC", "qtr": qtr, "time": "9:30", "play_type": "no_play", "desc": "note",
         "vegas_wp": home_wp_next, "vegas_home_wp": home_wp_next, "home_score": 20, "away_score": 10, "play_id": pid + 1,
         "game_date": "2024-09-08"},
    ]


def text(game, pid):
    return f"play {pid}"


def rows():
    return (r(10, 0.5, 0.7) + r(20, 0.5, 0.6) + r(30, 0.5, 0.2, sack=1) + r(40, 0.5, 0.8, qtr=5)
            + r(50, 0.4, 0.6, play_type="run", passer=None, rusher=QB, scr=1, st="POST", game="2024_19_KC_BUF")
            + r(60, 0.5, 0.9, passer="00-9999999"))  # not a roster QB


def test_swing_rule_roles_and_scope():
    idx, files = qp.build(rows(), {QA: "Josh Allen", QB: "Josh Allen"}, text)
    a = files[QA]["swings"]
    assert [(s["role"], s["swing"]) for s in a] == [("pass", 0.2), ("sack", -0.3)]  # 0.10 below threshold, OT out
    b = files[QB]["swings"]
    assert b[0]["role"] == "scramble" and b[0]["season_type"] == "POST"
    assert len(files) == 2 and idx["dataThrough"] == "2024-09-08"
    row = next(q for q in idx["qbs"] if q["id"] == QA)
    assert (row["swings"], row["up"], row["down"], row["by_season"]) == (2, 1, 1, {"2024": [1, 1]})


def test_duplicate_names_get_unique_slugs():
    s = qp.assign_slugs({QA: "Josh Allen", QB: "Josh Allen", "00-0000003": "Patrick Mahomes"})
    assert s == {QA: "josh-allen-0001", QB: "josh-allen-0002", "00-0000003": "patrick-mahomes"}


def test_frozen_guard():
    idx, files = qp.build(rows(), {QA: "A B", QB: "C D"}, text)
    assert qp.check_frozen(idx, idx, files, files) == []
    idx2, files2 = qp.build(rows()[2:], {QA: "A B", QB: "C D"}, text)
    bad = qp.check_frozen(idx, idx2, files, files2)
    assert any(b.startswith(QA) for b in bad) and f"index:{QA}" in bad
    _, files3 = qp.build(rows()[:8], {QA: "A B"}, text)
    assert f"{QB}:file removed" in qp.check_frozen(None, idx, files, files3)


def test_site_files_consistent_and_clean():
    idx = json.loads(INDEX.read_text())
    assert idx["stub"] is False and idx["season_list"] == list(range(2019, 2026)) and idx["builtAt"] and idx["dataThrough"]
    slugs = [q["slug"] for q in idx["qbs"]]
    assert len(slugs) == len(set(slugs))
    files = {p.stem: json.loads(p.read_text()) for p in PDIR.glob("*.json")}
    assert set(files) == {q["id"] for q in idx["qbs"]}
    for q in idx["qbs"]:
        sws = files[q["id"]]["swings"]
        assert q["swings"] == len(sws) == q["up"] + q["down"]
        assert all(s["qtr"] <= 4 and abs(s["swing"]) >= 0.1499 for s in sws)
        assert sum(sum(v) for v in q["by_season"].values()) == q["swings"]
    for f in [idx, *files.values()]:
        assert not BANNED.findall(json.dumps(list(_keys(f))))
    assert INDEX.stat().st_size < 30_000 and max(p.stat().st_size for p in PDIR.glob("*.json")) < 30_000


def _keys(o):
    if isinstance(o, dict):
        for k, v in o.items():
            yield k
            yield from _keys(v)
    elif isinstance(o, list):
        for v in o:
            yield from _keys(v)
