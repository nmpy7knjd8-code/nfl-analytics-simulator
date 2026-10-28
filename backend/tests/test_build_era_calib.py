"""mining/build_era.py (F4 era/v1) and mining/build_calib.py (D2 calib/v1): nflverse counts, house rules, frozen."""
from __future__ import annotations

import glob
import importlib.util
import json
import os
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "backend/tests/fixtures"
BANNED = re.compile(r"epa|xpass|play_id|wpa|spread|odds|moneyline", re.I)


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"mining/{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


be, bc = _load("build_era"), _load("build_calib")
ERA_SITE, CALIB_SITE = ROOT / "data/site/era.json", ROOT / "data/site/calib.json"
# every nflverse 2025 down == 4 row: [play_type, yardline_100, kick_distance]
ERA_ROWS = [{"season": 2025, "game_date": "2026-02-08", "down": 4, "play_type": p, "yardline_100": y,
             "kick_distance": k} for p, y, k in json.loads((FIX / "era_pbp_2025_4th.json").read_text())]
# every nflverse row of four 2025 week-1 games: [qtr, play_type, kick_distance, vegas_home_wp, result]
CAL_ROWS = [{"game_id": "g", "season": 2025, "game_date": "2025-09-07", "qtr": q, "play_type": p, "kick_distance": k,
             "vegas_home_wp": w, "result": r} for q, p, k, w, r in json.loads((FIX / "calib_pbp_2025_w1.json").read_text())]


# ---------- era ----------
def test_era_2025_matches_nflverse_and_committed_file():
    built = be.build(ERA_ROWS)["seasons"][0]
    site = next(s for s in json.loads(ERA_SITE.read_text())["seasons"] if s["season"] == 2025)
    assert built == site
    assert built["all"] == [3995, 931]  # 2025: the 2 FG tries over 64 yd are left out
    kept = [r for r in ERA_ROWS if be.is_fourth_down_decision(r)]
    assert sum(r["play_type"] in ("run", "pass") for r in kept) == built["all"][1]


def test_era_anchor_rates_and_shape():
    data = json.loads(ERA_SITE.read_text())
    assert [s["season"] for s in data["seasons"]] == list(range(2019, 2026))
    rate = lambda c: round(100 * c[1] / c[0], 1)
    s19, s25 = data["seasons"][0], data["seasons"][-1]
    assert [rate(s19[k]) for k in ("opp", "mid", "own", "all")] == [25.5, 18.9, 6.7, 16.3]
    assert [rate(s25[k]) for k in ("opp", "mid", "own", "all")] == [32.7, 29.2, 8.6, 23.3]
    for s in data["seasons"]:
        assert s["all"] == [sum(s[z][j] for z in ("opp", "mid", "own")) for j in (0, 1)]
    assert set(data) == {"schema", "source", "builtAt", "zones", "seasons"} and data["schema"] == "era/v1"
    assert ERA_SITE.stat().st_size < 3_000 and not BANNED.search(ERA_SITE.read_text())


def test_era_filter():
    base = {"season": 2025, "down": 4, "yardline_100": 50, "kick_distance": None}
    assert be.is_fourth_down_decision({**base, "play_type": "punt"})
    assert not be.is_fourth_down_decision({**base, "play_type": "field_goal", "kick_distance": 65})
    assert be.is_fourth_down_decision({**base, "play_type": "field_goal", "kick_distance": 64})
    assert not be.is_fourth_down_decision({**base, "down": 3, "play_type": "run"})
    assert not be.is_fourth_down_decision({**base, "play_type": "no_play"})
    assert [be.zone_id(y) for y in (1, 40, 41, 60, 61, 99)] == ["opp", "opp", "mid", "mid", "own", "own"]


def test_era_frozen(tmp_path, monkeypatch):
    built = be.build(ERA_ROWS)
    old = json.loads(be.dumps(built))
    assert be.check_frozen(old, built) == []
    old["seasons"][0]["opp"][1] += 1
    assert be.check_frozen(old, built) == ["2025"]
    out = tmp_path / "era.json"
    out.write_text(json.dumps(old))
    monkeypatch.setattr(be, "load_rows", lambda p: ERA_ROWS)
    assert be.main(["x", "--out", str(out)]) == 1 and json.loads(out.read_text()) == old


# ---------- calib ----------
def test_calib_filter_regulation_vegas_no_ties():
    r = {"game_id": "g", "season": 2025, "qtr": 2, "play_type": "pass", "vegas_home_wp": 0.4, "result": 3}
    assert bc.keep(r)
    assert not bc.keep({**r, "qtr": 5})
    assert not bc.keep({**r, "result": 0})
    assert not bc.keep({**r, "vegas_home_wp": None})
    assert not bc.keep({**r, "game_id": bc.BAD_GAME})
    assert not bc.keep({**r, "play_type": "field_goal", "kick_distance": 65})
    assert bc.bucket(0) == 0 and bc.bucket(4.999) == 0 and bc.bucket(5) == 1 and bc.bucket(100) == 11


def test_calib_values_recomputed_from_nflverse_rows():
    out = bc.build(CAL_ROWS)
    kept = [r for r in CAL_ROWS if bc.keep(r)]
    assert sum(b["plays"] for b in out["buckets"]) == len(kept)
    for i, b in enumerate(out["buckets"]):
        rs = [r for r in kept if bc.bucket(100 * r["vegas_home_wp"]) == i]
        assert b["plays"] == len(rs)
        if rs:
            assert b["predicted"] == round(100 * sum(r["vegas_home_wp"] for r in rs) / len(rs), 1)
            assert b["actual"] == round(100 * sum(r["result"] > 0 for r in rs) / len(rs), 1)


def test_calib_committed_file_shape():
    data = json.loads(CALIB_SITE.read_text())
    assert set(data) == {"schema", "model", "source", "builtAt", "buckets"}
    assert data["schema"] == "calib/v1" and data["model"] == "nflverse"
    assert [(b["lo"], b["hi"]) for b in data["buckets"]] == list(zip(bc.EDGES, bc.EDGES[1:]))
    assert sum(b["plays"] for b in data["buckets"]) == 338914
    assert data["buckets"][0] == {"lo": 0, "hi": 5, "plays": 29472, "predicted": 1.5, "actual": 2.1}
    for b in data["buckets"]:
        assert b["lo"] <= b["predicted"] <= b["hi"] and 0 <= b["actual"] <= 100
    assert CALIB_SITE.stat().st_size < 3_000 and not BANNED.search(CALIB_SITE.read_text())


def test_calib_frozen(tmp_path, monkeypatch):
    built = bc.build(CAL_ROWS)
    old = json.loads(bc.dumps(built))
    assert bc.check_frozen(old, built) == []
    old["buckets"][3]["actual"] = 0.0
    assert bc.check_frozen(old, built) == ["20-30"]
    out = tmp_path / "calib.json"
    out.write_text(json.dumps(old))
    monkeypatch.setattr(bc, "load_rows", lambda p: CAL_ROWS)
    assert bc.main(["x", "--out", str(out)]) == 1 and json.loads(out.read_text()) == old


# ---------- full rebuild (opt-in: FOURTH_PBP_DIR=<dir with pbp_2019..2025.parquet>) ----------
@pytest.mark.integration
def test_full_rebuild_matches_committed_files():
    d = os.environ.get("FOURTH_PBP_DIR")
    if not d:
        pytest.skip("FOURTH_PBP_DIR not set")
    paths = sorted(glob.glob(f"{d}/pbp_20*.parquet"))
    assert be.build(be.load_rows(paths)) == json.loads(ERA_SITE.read_text())
    assert bc.build(bc.load_rows(paths)) == json.loads(CALIB_SITE.read_text())
