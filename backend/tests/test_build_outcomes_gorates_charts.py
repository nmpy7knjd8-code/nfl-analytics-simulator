"""D5 outcomes/v1, D6 gorates/v1, E3 matchcharts/v1 builders: nflverse counts, house rules, frozen guards."""
from __future__ import annotations

import glob
import importlib.util
import json
import os
import re
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "backend/tests/fixtures"
SITE = ROOT / "data/site"
BANNED = re.compile(r"epa|xpass|play_?id|wpa|spread|odds|moneyline|vegas|over/under", re.I)
sys.path.insert(0, str(ROOT / "mining"))


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"mining/{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bo, bg, bm = _load("build_outcomes"), _load("build_gorates"), _load("build_match_charts")

# every nflverse 2019-2025 row with down == 4 and ydstogo == 2: [play_type, yardline_100, yards_gained, conv, pen1d]
O_ROWS = [{"season": 2019, "game_date": "", "down": 4, "ydstogo": 2, "play_type": p, "yardline_100": y,
           "yards_gained": g, "fourth_down_converted": c, "first_down_penalty": f}
          for p, y, g, c, f in json.loads((FIX / "outcomes_4th_and_2.json").read_text())]
# every nflverse 2025 down == 4 row: [qtr, ydstogo, yardline_100, play_type, kick_distance]
G_ROWS = [{"season": 2025, "game_date": "", "down": 4, "qtr": q, "ydstogo": d, "yardline_100": y, "play_type": p,
           "kick_distance": k} for q, d, y, p, k in json.loads((FIX / "gorates_2025_4th.json").read_text())]
# every nflverse row of 2023_01_ARI_WAS and 2023_01_BUF_NYJ (overtime)
C_ROWS = json.loads((FIX / "charts_2023_two_games.json").read_text())


def _site(name):
    p = SITE / name
    return p, json.loads(p.read_text())


def _no_banned(path):
    text = path.read_text()
    assert not BANNED.search(text), path


# ---------- D5 outcomes ----------
def test_outcomes_4th_and_2_anchor():
    built = bo.build(O_ROWS)["cells"]["2-all"]
    _, site = _site("outcomes.json")
    assert built == site["cells"]["2-all"]
    assert built["tries"] == 807 and built["counts"][bo.BINS.index(0)] == 240
    assert sum(built["counts"]) == 807
    assert sum(site["cells"][f"2-{z}"]["tries"] for z in ("opp", "mid", "own")) == 807


def test_outcomes_bins_and_shape():
    assert bo.bin_index(-34) == 0 and bo.bin_index(73) == len(bo.BINS) - 1 and bo.BINS[bo.bin_index(0)] == 0
    p, site = _site("outcomes.json")
    assert site["schema"] == "outcomes/v1" and site["seasons"] == [2019, 2025]
    assert set(site["cells"]) == {f"{d}-{z}" for d in range(1, 11) for z in ("opp", "mid", "own", "all")}
    for c in site["cells"].values():
        assert len(c["counts"]) == 26 and sum(c["counts"]) == c["tries"] and c["converted"] <= c["tries"]
    assert p.stat().st_size < 10_000
    _no_banned(p)


def test_outcomes_frozen(tmp_path, monkeypatch):
    built = bo.build(O_ROWS)
    old = json.loads(bo.dumps(built))
    assert bo.check_frozen(old, built) == []
    old["cells"]["2-all"]["counts"][5] += 1
    assert bo.check_frozen(old, built) == ["2-all"]
    out = tmp_path / "o.json"
    out.write_text(json.dumps(old))
    monkeypatch.setattr(bo, "load_rows", lambda p: O_ROWS)
    assert bo.main(["x", "--out", str(out)]) == 1 and json.loads(out.read_text()) == old


# ---------- D6 gorates ----------
def test_gorates_regulation_cap_and_counts():
    base = {"down": 4, "qtr": 4, "ydstogo": 1, "yardline_100": 50, "play_type": "run"}
    assert bg.keep(base) and not bg.keep({**base, "qtr": 5})
    assert not bg.keep({**base, "play_type": "field_goal", "kick_distance": 65})
    assert [bg.band_index(y) for y in (1, 10, 11, 90, 91, 99)] == [0, 0, 1, 8, 9, 9]
    built = bg.build(G_ROWS)
    kept = [r for r in G_ROWS if bg.keep(r)]
    assert sum(c[0] for row in built["cells"] for c in row) == len(kept)
    for row in built["cells"]:
        for plays, went, fg, punts in row:
            assert plays == went + fg + punts


def test_gorates_committed_file():
    p, site = _site("gorates.json")
    assert site["schema"] == "gorates/v1" and site["maxFgYards"] == 64 and site["distances"] == list(range(1, 11))
    assert len(site["bands"]) == 10 and site["bands"][-1] == {"min": 91, "max": 99}
    assert sum(c[0] for row in site["cells"] for c in row) == 27488  # 27,494 regulation 4th downs - 6 FG > 64 yd
    assert site["cells"][0][0] == [510, 442, 68, 0]  # 4th-and-1 at the opp 1-10
    for row in site["cells"]:  # no field goal tries from band 51+ (every kick there would be 68+ yd)
        assert all(c[2] == 0 for c in row[5:])
    assert p.stat().st_size < 5_000
    _no_banned(p)


def test_gorates_frozen():
    built = bg.build(G_ROWS)
    old = json.loads(bg.dumps(built))
    assert bg.check_frozen(old, built) == []
    old["cells"][2][4][1] += 1
    assert bg.check_frozen(old, built) == ["3-4"]


# ---------- E3 match charts ----------
def test_charts_regulation_only_with_ot_flag():
    built = bm.build(C_ROWS)[2023]["games"]
    by = {g["gameId"]: g for g in built}
    ot, reg = by["2023_01_BUF_NYJ"], by["2023_01_ARI_WAS"]
    assert ot["ot"] is True and reg["ot"] is False
    for g in built:
        assert len(g["wp"]) == 60 and all(0 <= v <= 1 for v in g["wp"])
    reg_rows = [r for r in C_ROWS if r["game_id"] == "2023_01_BUF_NYJ" and 1 <= r["qtr"] <= 4
                and r["vegas_home_wp"] is not None]
    reg_rows.sort(key=lambda r: r["play_id"])
    assert ot["wp"][-1] == round(reg_rows[-1]["vegas_home_wp"], 3)  # last point = end of regulation, not OT
    assert ot["wp"][0] == round(reg_rows[0]["vegas_home_wp"], 3)
    _, site = _site("charts/2023.json")
    assert {g["gameId"]: g for g in site["games"]}["2023_01_BUF_NYJ"] == ot


def test_charts_committed_files():
    files = sorted((SITE / "charts").glob("*.json"))
    assert [f.stem for f in files] == [str(y) for y in range(2019, 2026)]
    total = 0
    for f in files:
        d = json.loads(f.read_text())
        assert d["schema"] == "matchcharts/v1" and d["season"] == int(f.stem) and d["points"] == 60
        assert all(g["gameId"] != bm.BAD_GAME and len(g["wp"]) == 60 for g in d["games"])
        assert f.stat().st_size < 150_000
        _no_banned(f)
        total += len(d["games"])
    assert total == 1960  # every nflverse game 2019-2025 (2022_17_BUF_CIN has no pbp rows; still filtered)


def test_charts_frozen(tmp_path, monkeypatch):
    built = bm.build(C_ROWS)[2023]
    old = json.loads(bm.dumps(built))
    assert bm.check_frozen(old, built) == []
    old["games"][0]["wp"][10] = 0.5
    assert bm.check_frozen(old, built) == [old["games"][0]["gameId"]]
    (tmp_path / "2023.json").write_text(json.dumps(old))
    monkeypatch.setattr(bm, "load_rows", lambda p: C_ROWS)
    assert bm.main(["x", "--out-dir", str(tmp_path)]) == 1
    assert json.loads((tmp_path / "2023.json").read_text()) == old


@pytest.mark.integration
def test_full_rebuild_matches_committed_files():
    d = os.environ.get("FOURTH_PBP_DIR")
    if not d:
        pytest.skip("FOURTH_PBP_DIR not set")
    paths = sorted(glob.glob(f"{d}/pbp_20*.parquet"))
    strip = lambda o: {k: v for k, v in o.items() if k != "builtAt"}
    assert strip(bo.build(bo.load_rows(paths))) == strip(_site("outcomes.json")[1])
    assert strip(bg.build(bg.load_rows(paths))) == strip(_site("gorates.json")[1])
    for s, new in bm.build(bm.load_rows(paths)).items():
        assert strip(new) == strip(_site(f"charts/{s}.json")[1])
