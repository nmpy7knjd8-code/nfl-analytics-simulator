"""QA H5/M9: every swing / chart / OT play in frontend/lib/swingPlays.json is a real nflverse pbp row.

Uses the committed pbp slice backend/tests/fixtures/swing_pbp_rows.json, so CI needs no raw data.
"""
import json
from pathlib import Path

from nfl_sim.swing_examples import GAME_IDS, SWING_PLAY_TYPES, build_export

ROOT = Path(__file__).resolve().parents[2]
ROWS = json.loads((ROOT / "backend/tests/fixtures/swing_pbp_rows.json").read_text())
EXPORT = json.loads((ROOT / "frontend/lib/swingPlays.json").read_text())
BY_KEY = {(r["game_id"], r["play_id"]): r for r in ROWS}


def _all_plays():
    for g in EXPORT["games"].values():
        yield from g["swings"]
        yield from g["overtime_plays"]
        yield from g["chart"]


def test_every_exported_play_matches_a_pbp_row():
    n = 0
    for p in _all_plays():
        r = BY_KEY.get((p["game_id"], p["play_id"]))
        assert r, f"{p['game_id']} {p['play_id']} not a pbp row"
        assert (int(r["qtr"]), r["time"], r["desc"]) == (p["qtr"], p["clock"], p["description"]), p
        n += 1
    assert n > 400


def test_export_is_reproducible_from_pbp():
    assert build_export(ROWS) == EXPORT


def test_swings_follow_shared_filter():
    assert set(EXPORT["games"]) == set(GAME_IDS)
    for g in EXPORT["games"].values():
        assert g["swings"]
        for s in g["swings"]:
            assert 1 <= s["qtr"] <= 4 and s["play_type"] in SWING_PLAY_TYPES
            assert "kneels" not in s["description"]


def test_m9_gipson_ot_punt_return_at_9_21():
    ot = EXPORT["games"]["2023_01_BUF_NYJ"]["overtime_plays"]
    assert len(ot) == 1 and ot[0]["qtr"] == 5 and ot[0]["clock"] == "09:21"
    assert "Gipson" in ot[0]["description"] and "TOUCHDOWN" in ot[0]["description"]
    assert ot[0]["home_score_after"] == 22 and ot[0]["away_score_after"] == 16


import re  # noqa: E402

from nfl_sim.play_text import MAX_WORDS  # noqa: E402
from nfl_sim.swing_examples import build_play_lists  # noqa: E402

PLAY_LISTS = {gid: json.loads((ROOT / f"frontend/lib/plays/{gid}.json").read_text()) for gid in GAME_IDS}
BAD_TEXT = re.compile(r"\(Shotgun\)|\(No Huddle|\b\d{1,2}:\d\d\b|\b\d{1,2}-[A-Z]")


def _every_play():
    yield from _all_plays()
    for pl in PLAY_LISTS.values():
        yield from pl["plays"]


def test_play_lists_rebuild_and_match_pbp():
    built = build_play_lists(ROWS)
    for gid, pl in PLAY_LISTS.items():
        assert pl == {"game_id": gid, "plays": built[gid]}
        assert len(pl["plays"]) > 100
        for p in pl["plays"]:
            assert not p["raw_desc"].startswith(("Timeout", "END "))


def test_every_play_fields_match_pbp_and_display_text_is_clean():
    for p in _every_play():
        r = BY_KEY[(p["game_id"], p["play_id"])]
        assert (int(r["qtr"]), r["time"], r["desc"]) == (p["qtr"], p["clock"], p["raw_desc"]), p
        assert p["raw_desc"] == p["description"]
        assert p["down"] == (None if r["down"] is None else int(r["down"]))
        assert p["distance"] == (None if r["ydstogo"] is None else int(r["ydstogo"]))
        t = p["display_text"]
        assert t and len(t.split()) <= MAX_WORDS, t
        assert not BAD_TEXT.search(t), t
        assert p["event"] in ("turnover_on_downs", "interception", "fumble_lost", "touchdown", "field_goal", "punt", "other")


def test_score_before_matches_pbp():
    for p in _every_play():
        r = BY_KEY[(p["game_id"], p["play_id"])]
        if r.get("posteam") and r.get("posteam_score") is not None:
            home_is_pos = r["posteam"] == r["home_team"]
            assert p["home_score_before"] == int(r["posteam_score" if home_is_pos else "defteam_score"]), p
            assert p["away_score_before"] == int(r["defteam_score" if home_is_pos else "posteam_score"]), p
        assert p["home_score_before"] <= p["home_score_after"] and p["away_score_before"] <= p["away_score_after"]


def test_branch_pick_six_display_text():
    sw = {s["play_id"]: s for s in EXPORT["games"]["2023_01_DET_KC"]["swings"]}
    texts = [s["display_text"] for s in sw.values()]
    assert "Brian Branch intercepts Patrick Mahomes and returns it 50 yards for a touchdown." in texts
