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
