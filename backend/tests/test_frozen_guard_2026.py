"""2026 PR1: frozen-guard redesign (mining/_frozen.py). Synthetic fixtures only; no 2026 data ships.

* a season-span / source change (a fake extra season) can no longer rewrite 2019-2025 cells
  (gorates, outcomes, calib, era, fg_rates, team totals);
* new rows are append-only and never land in a closed season or a watermarked (completed) week;
* ranked lists may grow but never evict a published row;
* "finished game" = final score present AND play-by-play reaches the end (games-v8 rule), incl. a game
  half-loaded mid-day;
* the full 2019-2025 rebuild is byte-identical (runs when NFL_PBP_DIR points at the pbp parquets).
"""
from __future__ import annotations

import copy
import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / "backend/tests/fixtures"
sys.path.insert(0, str(ROOT / "mining"))
import _frozen as fz  # noqa: E402


def _load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f"mining/{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


bg, bo, bc, be, bf = (_load(n) for n in ("build_gorates", "build_outcomes", "build_calib", "build_era",
                                         "build_fg_rates"))
bod, bw, bdr, bmc, bcb = (_load(n) for n in ("build_onthisday", "build_weather", "build_drives",
                                             "build_match_charts", "build_comebacks"))

G_ROWS = [{"season": 2025, "game_date": "", "down": 4, "qtr": q, "ydstogo": d, "yardline_100": y, "play_type": p,
           "kick_distance": k} for q, d, y, p, k in json.loads((FIX / "gorates_2025_4th.json").read_text())]
O_ROWS = [{"season": 2019, "game_date": "", "down": 4, "ydstogo": 2, "play_type": p, "yardline_100": y,
           "yards_gained": g, "fourth_down_converted": c, "first_down_penalty": f}
          for p, y, g, c, f in json.loads((FIX / "outcomes_4th_and_2.json").read_text())]
CAL_ROWS = [{"game_id": "g", "season": 2025, "game_date": "2025-09-07", "qtr": q, "play_type": p, "kick_distance": k,
             "vegas_home_wp": w, "result": r} for q, p, k, w, r in json.loads((FIX / "calib_pbp_2025_w1.json").read_text())]
ERA_ROWS = [{"season": 2025, "game_date": "2026-02-08", "down": 4, "play_type": p, "yardline_100": y,
             "kick_distance": k} for p, y, k in json.loads((FIX / "era_pbp_2025_4th.json").read_text())]


def fake_season(rows, season):
    """The same plays again, relabelled as another season: a span change that moves every total."""
    return [{**r, "season": season, "game_date": f"{season}-10-01"} for r in rows[: max(1, len(rows) // 3)]]


def rt(d):
    return json.loads(json.dumps(d))


# ---------- span change can no longer rewrite historical cells ----------
@pytest.mark.parametrize("mod,rows", [(bg, G_ROWS), (bo, O_ROWS), (bc, CAL_ROWS)], ids=["gorates", "outcomes", "calib"])
@pytest.mark.parametrize("extra", [2026, 2018])
def test_span_change_cannot_rewrite_cells(mod, rows, extra):
    old = rt(mod.build(rows))
    new = mod.build(rows + fake_season(rows, extra))
    assert old.get("seasons") != new.get("seasons") or old["source"] != new["source"]  # the span really changed
    assert mod.check_frozen(old, new), "a span change used to skip the guard; it must now report the cells"


@pytest.mark.parametrize("mod,rows", [(bg, G_ROWS), (bo, O_ROWS), (bc, CAL_ROWS)], ids=["gorates", "outcomes", "calib"])
def test_span_change_alone_is_not_a_value_change(mod, rows):
    old = rt(mod.build(rows))
    junk = [{**r, "season": 2026, "qtr": 5, "down": 1} for r in rows[:5]]  # rows every house rule drops
    new = mod.build(rows + junk)
    assert mod.check_frozen(old, new) == []


def test_calib_source_string_change_still_checked():
    old = rt(bc.build(CAL_ROWS))
    new = bc.build(CAL_ROWS + fake_season(CAL_ROWS, 2026))
    assert old["source"] != new["source"] and bc.check_frozen(old, new)


@pytest.mark.parametrize("mod", [bg, bo, bc], ids=["gorates", "outcomes", "calib"])
def test_span_change_build_exits_1_and_writes_nothing(mod, tmp_path, monkeypatch):
    rows = {bg: G_ROWS, bo: O_ROWS, bc: CAL_ROWS}[mod]
    out = tmp_path / "x.json"
    out.write_text(mod.dumps(mod.build(rows)))
    before = out.read_bytes()
    monkeypatch.setattr(mod, "load_rows", lambda paths: rows + fake_season(rows, 2026))
    assert mod.main(["x.parquet", "--out", str(out)]) == 1
    assert out.read_bytes() == before


def test_era_and_fg_rates_closed_seasons():
    old = rt(be.build(ERA_ROWS))
    assert be.check_frozen(old, be.build(ERA_ROWS + fake_season(ERA_ROWS, 2026))) == []  # open season: own row
    assert be.check_frozen(old, be.build(ERA_ROWS + fake_season(ERA_ROWS, 2018))) == ["2018 added"]
    fg = [{"season": 2025, "game_date": "2026-01-01", "play_type": "field_goal", "kick_distance": 40,
           "field_goal_result": "made"}]
    old = rt(bf.build(fg))
    new = bf.build(fg + [{**fg[0], "season": 2026}])
    assert bf.check_frozen(old, new) == ["all"]  # "all" stays the frozen 2019-2025 numbers


# ---------- append-only, watermark, ranked lists (shared guard) ----------
def doc(*gids, summary=None):
    return {"season_list": [], "plays": [{"game_id": g, "v": 1} for g in gids],
            "seasons": summary or {"2025": 1}, "league": {"n": 1}}


KEY = lambda r: r["game_id"]  # noqa: E731
OLD = doc("2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D")
NO_MARKS: dict = {}
MARK2 = {"x": {"2026": 2}}


def chk(new, marks=NO_MARKS, ranked=False, old=OLD):
    return fz.check_frozen(rt(old), rt(new), KEY, "plays", ("seasons", "league"), name="x", ranked=ranked, marks=marks)


def test_append_new_finished_game_ok():
    assert chk(doc("2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D", "2026_03_E_F")) == []


def test_watermark_freezes_completed_weeks():
    late = doc("2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D", "2026_02_G_H")  # a late week-2 game
    assert chk(late) == []                                     # week 2 still open: allowed
    assert any("frozen week" in b for b in chk(late, MARK2))    # week 2 watermarked: refused
    assert chk(doc("2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D", "2026_03_E_F"), MARK2) == []
    assert fz.watermark("x", 2026, MARK2) == 2 and fz.watermark("y", 2026, MARK2) == 0


def test_no_insert_into_closed_season():
    bad = chk(doc("2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D", "2019_05_NE_NYJ"))
    assert any("frozen week" in b for b in bad)


def test_append_only_order():
    bad = chk(doc("2025_22_KC_PHI", "2026_03_E_F", "2026_01_A_B", "2026_02_C_D"))
    assert any("append-only" in b for b in bad)
    assert chk(doc("2025_22_KC_PHI", "2026_03_E_F", "2026_01_A_B", "2026_02_C_D"), ranked=True) == []


def test_published_rows_never_change_or_disappear():
    new = doc("2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D")
    new["plays"][1]["v"] = 2
    assert "changed/removed 2026_01_A_B" in chk(new)
    assert "changed/removed 2026_02_C_D" in chk(doc("2025_22_KC_PHI", "2026_01_A_B"), ranked=True)  # no eviction


def test_ranked_list_may_grow_but_not_evict():
    grown = doc("2026_03_E_F", "2025_22_KC_PHI", "2026_01_A_B", "2026_02_C_D")
    assert chk(grown, ranked=True) == []
    capped = doc("2026_03_E_F", "2025_22_KC_PHI", "2026_01_A_B")  # top-N cap pushes a published row out
    assert any("2026_02_C_D" in b for b in chk(capped, ranked=True))


def test_summary_frozen_except_open_season_keys():
    assert chk({**OLD, "seasons": {"2025": 1, "2026": 7}}) == []
    assert chk({**OLD, "seasons": {"2025": 2}})
    assert chk({**OLD, "seasons": {"2025": 1, "2018": 1}})
    assert chk({**OLD, "league": {"n": 2}})  # all-seasons totals stay frozen
    assert chk({**OLD, "season_list": [2019, 2026], "league": {"n": 2}})  # ... whatever the season list


def test_unknown_game_id_counts_as_frozen():
    assert fz.is_frozen_game("garbage") and fz.is_frozen_game("2025_01_A_B") and not fz.is_frozen_game("2026_01_A_B", "x", {})


# ---------- builder-level guards ----------
def _otd(days, fallback=None):
    return {"schema": "onthisday/v1", "cols": ["id", "a", "b", "c", "ot"], "season_list": [2025],
            "days": days, "fallback": fallback or {}}


def test_onthisday_append_only_and_watermark(monkeypatch):
    old = _otd({"09-10": [["2025_01_A_B", 1, 2, 3, False]]})
    ok = _otd({"09-10": [["2025_01_A_B", 1, 2, 3, False], ["2026_01_C_D", 1, 2, 3, False]]})
    assert bod.check_frozen(rt(old), rt(ok)) == []
    first = _otd({"09-10": [["2026_01_C_D", 1, 2, 3, False], ["2025_01_A_B", 1, 2, 3, False]]})
    assert bod.check_frozen(rt(old), rt(first))
    closed = _otd({"09-10": [["2025_01_A_B", 1, 2, 3, False], ["2024_01_C_D", 1, 2, 3, False]]})
    assert bod.check_frozen(rt(old), rt(closed))
    monkeypatch.setattr(fz, "load_watermarks", lambda path=None: {"onthisday": {"2026": 1}})
    assert bod.check_frozen(rt(old), rt(ok))


def test_weather_new_games_only_open_season():
    old = {"schema": "weather/v1", "season_list": [2025], "bands": {}, "games": {"2025_01_A_B": [1, 2]}, "indoors": ["2025_02_X_Y"]}
    new = copy.deepcopy(old)
    new["games"]["2026_01_C_D"] = [3, 4]
    new["indoors"].append("2026_01_E_F")
    new["season_list"] = [2025, 2026]
    assert bw.check_frozen(old, new) == []
    new["games"]["2024_05_C_D"] = [3, 4]
    assert bw.check_frozen(old, new) == ["games added: 2024_05_C_D"]


def test_drives_and_charts_insert_into_frozen_week():
    od = {"schema": "s", "cols": [], "games": {"2026_01_A_B": [1]}}
    nd = {"schema": "s", "cols": [], "games": {"2026_01_A_B": [1], "2026_02_C_D": [2]}}
    assert bdr.check_frozen(od, nd) == []
    nd["games"]["2025_02_C_D"] = [2]
    assert bdr.check_frozen(od, nd) == ["2025_02_C_D (inserted into a frozen week)"]
    oc = {"schema": "s", "points": 60, "games": [{"gameId": "2026_01_A_B", "wp": [1]}]}
    nc = {"schema": "s", "points": 60, "games": [{"gameId": "2026_01_A_B", "wp": [1]}, {"gameId": "2026_02_C_D", "wp": [2]}]}
    assert bmc.check_frozen(oc, nc) == []
    nc["games"].insert(0, {"gameId": "2026_03_E_F", "wp": [3]})
    assert bmc.check_frozen(oc, nc)


def test_drives_new_closed_season_file_refused(tmp_path, monkeypatch):
    (tmp_path / "2025.json").write_text(json.dumps({"schema": "s", "cols": [], "games": {}}))
    monkeypatch.setattr(bdr, "load_rows", lambda p: [])
    monkeypatch.setattr(bdr, "build", lambda rows: {2018: {"schema": "s", "cols": [], "games": {}}})
    assert bdr.main(["x.parquet", "--out-dir", str(tmp_path)]) == 1
    assert sorted(p.name for p in tmp_path.iterdir()) == ["2025.json"]


# ---------- finished games (games-v8 rule) ----------
def game(gid="2026_10_KC_BUF", upto_qtr=4, end_row=True, home=24, away=21, final=(24, 21), season_type="REG"):
    rows, h, a = [], 0, 0
    for q in range(1, upto_qtr + 1):
        h, a = (final if q == upto_qtr else (h + 3, a))
        rows.append({"game_id": gid, "qtr": q, "desc": "pass", "quarter_end": 0, "home_score": home,
                     "total_home_score": h, "total_away_score": a, "season_type": season_type})
        rows.append({"game_id": gid, "qtr": q, "desc": f"END QUARTER {q}", "quarter_end": 1, "home_score": home,
                     "total_home_score": h, "total_away_score": a, "season_type": season_type})
    if end_row:
        rows.append({**rows[-1], "desc": "END GAME", "quarter_end": 0})
    return rows


def test_finished_game_rule():
    assert fz.is_finished_game(game())
    assert fz.is_finished_game(game(end_row=False))                      # Q4 closed, not tied
    assert not fz.is_finished_game(game(end_row=False, final=(21, 21)))  # tied after Q4: overtime pending
    assert fz.is_finished_game(game(upto_qtr=5, end_row=False, final=(20, 20)))  # REG tie after OT
    assert not fz.is_finished_game(game(upto_qtr=5, end_row=False, final=(20, 20), season_type="POST"))
    assert not fz.is_finished_game(game(home=None))                      # no final score yet
    assert not fz.is_finished_game([])


def test_half_loaded_game_mid_day_is_not_finished():
    """nflverse pushed the 1 PM games while the 4:25 game was still in Q2: no final score, pbp stops mid-game."""
    done = game("2026_10_KC_BUF")
    half = [r for r in game("2026_10_DAL_NYG", home=None) if r["qtr"] <= 2][:-1]  # Q2 not even closed
    half_scored = [r for r in game("2026_10_SF_SEA") if r["qtr"] <= 2]  # score column filled early, pbp at half
    rows = done + half + half_scored
    assert fz.finished_game_ids(rows) == {"2026_10_KC_BUF"}


def test_read_pbp_keeps_only_finished_games(tmp_path):
    pd = pytest.importorskip("pandas")
    pytest.importorskip("pyarrow")
    rows = game("2026_10_KC_BUF") + [r for r in game("2026_10_DAL_NYG", home=None) if r["qtr"] <= 2]
    for r in rows:
        r["yardline_100"] = 50
    p = tmp_path / "pbp_2026.parquet"
    pd.DataFrame(rows).to_parquet(p)
    df = fz.read_pbp([str(p)], ["game_id", "yardline_100"])
    assert list(df.columns) == ["game_id", "yardline_100"]
    assert set(df.game_id) == {"2026_10_KC_BUF"} and len(df) == len(game())


# ---------- watermark file ----------
def test_watermark_file_shape():
    d = json.loads(fz.WATERMARKS.read_text())
    assert set(d) == {"doc", "weeks"}
    for name, seasons in d["weeks"].items():
        for s, w in seasons.items():
            assert int(s) > fz.FROZEN_THROUGH and isinstance(w, int) and 0 <= w <= 22, (name, s, w)


# ---------- full 2019-2025 rebuild: byte-identical (needs local pbp parquets) ----------
@pytest.mark.skipif(not os.environ.get("NFL_PBP_DIR"), reason="set NFL_PBP_DIR (+ NFL_REF_DIR, NFL_GAMES_DIR) to rebuild")
def test_full_rebuild_byte_identical():
    argv = [sys.executable, str(ROOT / "mining/verify_rebuild.py"), "--pbp-dir", os.environ["NFL_PBP_DIR"]]
    if os.environ.get("NFL_REF_DIR"):
        argv += ["--ref-dir", os.environ["NFL_REF_DIR"]]
    if os.environ.get("NFL_GAMES_DIR"):
        argv += ["--games-dir", os.environ["NFL_GAMES_DIR"]]
    r = subprocess.run(argv, capture_output=True, text=True)
    assert r.returncode == 0 and "ALL IDENTICAL" in r.stdout, r.stdout[-3000:] + r.stderr[-2000:]
