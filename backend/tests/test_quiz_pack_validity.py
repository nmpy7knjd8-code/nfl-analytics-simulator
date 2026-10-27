"""Quiz content must be real plays: real team codes, valid clocks, no out-of-range FGs."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from nfl_sim.models.fourth_down_empirics import FG_SNAP_YARDS, MAX_FG_DISTANCE
from nfl_sim.quiz.pack import QUIZ_PACK_PATH

REPO = Path(__file__).resolve().parents[2]
NFL_TEAMS = set("ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA LAC LV MIA "
                "MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS".split())
GAME_ID = re.compile(r"^(\d{4})_(\d{2})_([A-Z]{2,3})_([A-Z]{2,3})$")
PACK = json.loads(QUIZ_PACK_PATH.read_text())
ITEMS = PACK["items"]


def test_frontend_pack_is_backend_pack_minus_model_details():
    front = json.loads((REPO / "frontend/lib/quizPack.json").read_text())
    back = json.loads(QUIZ_PACK_PATH.read_text())
    for it in back["items"]:
        it["reveal"].pop("model_notes", None)
        it["reveal"].pop("edge_wp", None)
    assert front == back


def test_pack_size_and_unique_ids():
    assert len(ITEMS) >= 365
    assert len({i["id"] for i in ITEMS}) == len(ITEMS)


@pytest.mark.parametrize("item", ITEMS, ids=lambda i: i["id"])
def test_item_is_a_real_play(item):
    s, src = item["situation"], item["source"]
    assert item["kind"] == "historical"
    m = GAME_ID.match(src["game_id"] or "")
    assert m, src
    season, week, away, home = int(m[1]), int(m[2]), m[3], m[4]
    assert (src["season"], src["week"], s["away_team"], s["home_team"]) == (season, week, away, home)
    assert isinstance(src["play_id"], int) and src["play_id"] > 0
    # Real team codes, and the two sides are this game's teams.
    assert {s["posteam"], s["defteam"]} == {s["home_team"], s["away_team"]} <= NFL_TEAMS
    assert item["label"].startswith(f"{away} @ {home} — 4th & {s['distance']}")
    # Scoreboard
    assert s["posteam_score"] >= 0 and s["defteam_score"] >= 0
    assert s["score_differential"] == s["posteam_score"] - s["defteam_score"]
    # Clock: quarter clock 0:00–15:00 and consistent with game/half clocks.
    q, qs = s["qtr"], s["quarter_seconds_remaining"]
    assert 1 <= q <= 4 and 0 <= qs <= 900
    assert s["game_seconds_remaining"] == (4 - q) * 900 + qs
    assert s["half_seconds_remaining"] == (2 - (q - 1) % 2 - 1) * 900 + qs
    assert s["down"] == 4 and 1 <= s["distance"] <= 99 and 1 <= s["yardline_100"] <= 99


@pytest.mark.parametrize("item", ITEMS, ids=lambda i: i["id"])
def test_no_field_goal_beyond_64_yards(item):
    kick = item["situation"]["yardline_100"] + FG_SNAP_YARDS
    r = item["reveal"]
    if kick > MAX_FG_DISTANCE:
        assert "fg" not in r["values"], f"{kick}-yd FG offered"
        assert r["recommendation"] != "fg"
        assert item["historical_action"] != "fg"
    assert set(r["values"]) <= {"go", "fg", "punt"} and {"go", "punt"} <= set(r["values"])
    assert all(0.0 <= v <= 1.0 for v in r["values"].values())
    assert r["recommendation"] in {"go", "fg", "punt", "inconclusive"}


def test_pack_has_a_real_mix():
    recs = [i["reveal"]["recommendation"] for i in ITEMS]
    for a in ("go", "fg", "punt"):
        assert recs.count(a) >= len(ITEMS) * 0.15
    assert recs.count("inconclusive") <= len(ITEMS) * 0.2


def test_close_call_is_under_two_points_of_win_chance():
    # Brief: "Close call" when the best two options are within 2 pts of win chance.
    for item in ITEMS:
        r = item["reveal"]
        if r["margin"] is not None:
            assert r["inconclusive"] == (r["margin"] < 0.02), item["id"]


def test_assumptions_use_nflverse_kick_distance():
    for item in ITEMS:
        assert not any("+ 17" in a for a in item["reveal"].get("assumptions", [])), item["id"]
