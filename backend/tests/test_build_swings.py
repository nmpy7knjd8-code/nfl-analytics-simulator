"""mining/build_swings.py: C2/C3 swings.json (shared swing filter, nflverse values, frozen weeks)."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_swings", ROOT / "mining/build_swings.py")
bs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bs)

_FX = json.loads((ROOT / "backend/tests/fixtures/swings_pbp_rows.json").read_text())
ROWS, TEXTS = _FX["rows"], _FX["texts"]


def text_of(game_id, play_id):
    return TEXTS[f"{game_id}:{int(float(play_id))}"]
SITE = ROOT / "data/site/swings.json"
RECORD_KEYS = {"season", "week", "round", "game_id", "home", "away", "home_score", "away_score", "team", "qtr", "clock", "down", "togo",
               "yardline_100", "play_type", "desc", "wp_before", "wp_after", "swing"}
BANNED_KEY = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|line|odds|total", re.I)


@pytest.fixture(scope="module")
def built():
    return bs.build(ROWS, text_of)


def _records(out):
    return list(out["weeks"].values()) + out["top"]


def _src(rec):
    return next(r for r in ROWS if r["game_id"] == rec["game_id"] and r["qtr"] == rec["qtr"] and r["time"] == rec["clock"]
                and r["play_type"] == rec["play_type"] and r["posteam"] == rec["team"])


def test_values_match_nflverse_exactly(built):
    for rec in _records(built):
        r = _src(rec)
        assert rec["wp_before"] == round(r["vegas_wp"], 4)
        assert rec["swing"] == round(rec["wp_after"] - r["vegas_wp"], 4) or abs(
            rec["swing"] - (rec["wp_after"] - r["vegas_wp"])) < 1.5e-4
        assert rec["desc"] == text_of(r["game_id"], r["play_id"])


def test_q3_wp_after_skips_clockless_out_of_order_row_and_uses_final_at_game_end():
    rows = bs.attach_after([dict(r) for r in ROWS])
    pit = next(r for r in rows if r["game_id"] == "2019_01_PIT_NE" and r["time"] == "00:06" and r["play_type"] == "pass")
    # next nflverse row (play 4225) has no clock; END GAME has a lower play_id -> final result, PIT lost 3-33
    assert pit["_wp_after"] == 0.0


def test_q3_wp_after_uses_next_real_snap():
    rows = bs.attach_after([dict(r) for r in ROWS])
    g = [r for r in rows if r["game_id"] == "2024_19_WAS_TB"]
    fg = next(r for r in g if r["time"] == "04:45" and r["play_type"] == "field_goal")
    nxt = next(r for r in g if r["time"] and r["play_id"] > fg["play_id"] and r["vegas_home_wp"] is not None)
    assert fg["_wp_after"] == nxt["vegas_home_wp"] and fg["_wp_after"] < 0.6  # TB is home; not 100%


def test_q3_game_end_equals_result():
    rows = bs.attach_after([dict(r) for r in ROWS])
    for gid in {r["game_id"] for r in rows}:
        g = [r for r in rows if r["game_id"] == gid and r.get("_wp_after") is not None]
        if not g:
            continue
        last = max(g, key=lambda r: r["play_id"])
        nxt = [r for r in rows if r["game_id"] == gid and r["time"] and r["play_id"] > last["play_id"]
               and r["vegas_home_wp"] is not None and not r["desc"].upper().startswith("END GAME")]
        if not nxt:
            home = 1.0 if last["home_score"] > last["away_score"] else 0.0 if last["home_score"] < last["away_score"] else 0.5
            assert last["_wp_after"] == (home if last["posteam"] == last["home_team"] else 1 - home)


def test_q4_reversed_play_uses_display_text(built):
    rec = built["weeks"].get("2020-w09")
    assert rec and "REVERSED" not in rec["desc"] and "TOUCHDOWN" not in rec["desc"].upper()
    assert all("REVERSED" not in r["desc"] for r in _records(built))


def test_top_swing_is_daniels_hail_mary(built):
    t = built["top"][0]
    assert (t["game_id"], t["team"], t["qtr"], t["play_type"]) == ("2024_08_CHI_WAS", "WAS", 4, "pass")
    assert "Jayden Daniels" in t["desc"] and t["swing"] > 0.8


def test_filter_drops_ot_kneels_bad_game_and_long_fg(built):
    for rec in _records(built):
        assert 1 <= rec["qtr"] <= 4
        assert rec["play_type"] in bs.SWING_PLAY_TYPES
    assert all(r["play_type"] != "run" or "kneels" not in r["desc"] for r in _records(built))
    assert not bs.is_swing_candidate({**ROWS[0], "play_type": "field_goal", "kick_distance": 65})
    assert not bs.is_swing_candidate({**ROWS[0], "qtr": 5})
    assert not bs.is_swing_candidate({**ROWS[0], "qb_kneel": 1})
    assert not bs.is_swing_candidate({**ROWS[0], "vegas_wp": None})


def test_cin_buf_drops_only_bad_row_and_play_before():
    marked = bs.mark_bad_rows(ROWS)
    bad = [r for r in marked if r.get("_bad_row")]
    assert [r["desc"][:13] for r in bad] == ["(:02) (Shotgu", "End of half -"]
    assert "A.Dalton" in bad[0]["desc"] and not bs.is_swing_candidate(bad[0])
    # any other regulation play from the game still counts (the game has no overtime)
    dalton = next(r for r in ROWS if r["game_id"] == bs.BAD_GAME and "A.Dalton" in (r["desc"] or ""))
    other = {**dalton, "time": "08:00", "desc": "(8:00) other play"}
    rows = [other] + ROWS
    assert any(r["desc"] == other["desc"] for r in bs.attach_after(bs.mark_bad_rows(rows)) if bs.is_swing_candidate(r))


def test_each_week_is_its_biggest_swing(built):
    cands = [r for r in bs.attach_after(bs.mark_bad_rows(ROWS)) if bs.is_swing_candidate(r)]
    for key, rec in built["weeks"].items():
        best = max(abs(r["_wp_after"] - r["vegas_wp"]) for r in cands if bs.week_key(r) == key)
        assert abs(rec["swing"]) == round(best, 4) or abs(abs(rec["swing"]) - best) < 1.5e-4
    tops = [abs(r["swing"]) for r in built["top"]]
    assert tops == sorted(tops, reverse=True)


def test_playoff_rounds(built):
    rounds = bs.post_round_map(ROWS)
    assert rounds[(2024, 19)] == "WC" and rounds[(2024, 22)] == "SB" and (2024, 8) not in rounds
    assert built["weeks"]["2024-w08"]["round"] is None


def test_frozen_weeks_fail_on_change(built):
    old = json.loads(bs.dumps(built))
    assert bs.check_frozen(old, built) == []
    k = next(iter(old["weeks"]))
    old["weeks"][k]["swing"] = 0.1234
    assert bs.check_frozen(old, built) == [f"{k} play/value changed (not in override)"]
    assert bs.check_frozen(old, built, [k]) == []
    other = list(old["weeks"])[-1]
    assert bs.check_frozen(old, built, [k, other]) == [f"{other} in override but play/value unchanged"]


def test_text_only_weeks_may_change_text_but_not_play_or_values(built):
    """Narrowed override: non-listed weeks may change desc/home_score/away_score only."""
    TEXT = ["desc", "home_score", "away_score"]
    k = next(iter(built["weeks"]))
    old = json.loads(bs.dumps(built))
    old["weeks"][k].update(desc="raw text", home_score=0, away_score=99)
    assert bs.check_frozen(old, built, [], TEXT) == []
    assert bs.check_frozen(old, built) == [f"{k} changed (not in override)"]
    for f in ("game_id", "qtr", "clock", "team", "play_type", "wp_before", "wp_after", "swing"):
        o2 = json.loads(bs.dumps(built))
        o2["weeks"][k][f] = "x" if isinstance(o2["weeks"][k][f], str) else 0.4321
        assert bs.check_frozen(o2, built, [], TEXT) == [f"{k} play/value changed (not in override)"], f
    o3 = json.loads(bs.dumps(built))
    o3["weeks"][k]["round"] = "XX"  # a non-text, non-play field still needs the full override
    assert bs.check_frozen(o3, built, [], TEXT) == [f"{k} changed (not in override)"]


def test_frozen_week_change_exits_nonzero(tmp_path, built, monkeypatch):
    out = tmp_path / "swings.json"
    old = json.loads(bs.dumps(built))
    k = next(iter(old["weeks"]))
    old["weeks"][k]["desc"] = "changed"
    out.write_text(json.dumps(old))
    monkeypatch.setattr(bs, "load_rows", lambda paths: ROWS)
    monkeypatch.setattr(bs, "display_texts", lambda d: text_of)
    assert bs.main(["x.parquet", "--out", str(out)]) == 1
    assert json.loads(out.read_text())["weeks"][k]["desc"] == "changed"
    ov = tmp_path / "ov.json"
    ov.write_text(json.dumps({"reason": "test", "reviewed_in": "test", "weeks": [], "text_fields_all_weeks": ["desc"]}))
    assert bs.main(["x.parquet", "--out", str(out), "--allow-changes", str(ov)]) == 0
    assert json.loads(out.read_text())["weeks"][k]["desc"] != "changed"


def test_committed_override_is_exact_and_reviewed():
    o = json.loads((ROOT / "mining/frozen_overrides/swings-2026-10-28-qa-q3-q4.json").read_text())
    assert o["reason"] and o["reviewed_in"]
    assert o["weeks"] == ["2019-w01", "2024-w19"]  # only these may change play/value
    assert o["text_fields_all_weeks"] == ["desc", "home_score", "away_score"]


def test_committed_site_file_is_small_and_clean():
    data = json.loads(SITE.read_text())
    assert SITE.stat().st_size < 100_000
    assert data["v"] == bs.SCHEMA_VERSION and len(data["top"]) == bs.TOP_N
    text = SITE.read_text()
    assert "End of half" not in text and "REVERSED" not in text
    # rebuild after the CIN_BUF row-level filter left the published 2019 week 3 pick unchanged
    assert data["weeks"]["2019-w03"]["game_id"] == "2019_03_NYG_TB"
    assert not re.search(r"\b(EPA|WPA|xpass)\b", text)
    for rec in _records(data):
        assert set(rec) == RECORD_KEYS
        assert not any(BANNED_KEY.search(k) for k in rec if k != "yardline_100")
        assert 1 <= rec["qtr"] <= 4 and 0 <= rec["wp_before"] <= 1 and 0 <= rec["wp_after"] <= 1
        assert re.fullmatch(r"\d{2}:\d{2}", rec["clock"])
    for key, rec in data["weeks"].items():
        assert key == f"{rec['season']}-w{rec['week']:02d}"


def _independent_swings(rows):
    """Re-derive every regulation swing without the builder's helpers (same house filters)."""
    out = []
    games = {}
    for i, r in enumerate(rows):
        games.setdefault(r["game_id"], []).append(i)
    bad = set()
    for idx in games.values():
        for k, i in enumerate(idx):
            if rows[i]["game_id"] == "2019_03_CIN_BUF" and (rows[i]["desc"] or "").startswith("End of half"):
                bad |= {i, idx[k - 1]} if k else {i}
    for idx in games.values():
        for k, i in enumerate(idx):
            r = rows[i]
            if (i in bad or r["qtr"] is None or not 1 <= r["qtr"] <= 4 or r["play_type"] not in ("run", "pass", "field_goal", "punt")
                    or r["qb_kneel"] or r["qb_spike"] or r["vegas_wp"] is None or not r["posteam"] or r["play_id"] is None
                    or (r["play_type"] == "field_goal" and (r["kick_distance"] or 0) > 64)):
                continue
            nxt = next((rows[j] for j in idx[k + 1:] if rows[j]["time"] and rows[j]["play_id"] is not None
                        and rows[j]["play_id"] > r["play_id"] and rows[j]["vegas_home_wp"] is not None
                        and not (rows[j]["desc"] or "").upper().startswith("END GAME")), None)
            if nxt is None:
                hp = 1.0 if r["home_score"] > r["away_score"] else 0.0 if r["home_score"] < r["away_score"] else 0.5
            else:
                hp = nxt["vegas_home_wp"]
            after = hp if r["posteam"] == r["home_team"] else 1 - hp
            out.append((f"{r['season']}-w{r['week']:02d}", r["game_id"], r["qtr"], r["time"], after - r["vegas_wp"]))
    return out


def test_each_week_pick_is_largest_regulation_swing_across_all_its_games(built):
    """QA (Analyte/Head Grokka): every week's pick = max |swing| over every play of every game that week."""
    sw = _independent_swings(ROWS)
    weeks = {w for w, *_ in sw}
    assert set(built["weeks"]) == weeks
    for w in weeks:
        best = max((x for x in sw if x[0] == w), key=lambda x: abs(x[4]))
        rec = built["weeks"][w]
        assert (rec["game_id"], rec["qtr"], rec["clock"]) == best[1:4], w
        assert abs(rec["swing"] - round(best[4], 4)) < 1e-9, w
    top = sorted(sw, key=lambda x: -abs(x[4]))[: len(built["top"])]
    assert [round(abs(t["swing"]), 4) for t in built["top"]] == [round(abs(x[4]), 4) for x in top]


def test_desc_is_clean_display_text(built):
    for r in _records(built):
        assert not re.search(r"\b\d{1,2}-[A-Z][a-zA-Z]*\.", r["desc"]), r["desc"]  # no "14-S.Darnold" jersey tags
        assert not r["desc"].startswith("(")  # no raw "(13:50) (Shotgun)" prefix
