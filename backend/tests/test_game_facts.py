"""Every game fact the UI shows must match nflverse (score, week, date, teams, OT)."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_game_facts", REPO / "backend/scripts/build_game_facts.py")
bgf = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bgf)

COMMITTED = json.loads(bgf.FACTS_PATH.read_text())["games"]


def test_facts_cover_every_fixture_game_and_ids_are_consistent():
    assert [g["game_id"] for g in COMMITTED] == list(bgf.FIXTURE_GAME_IDS)
    for g in COMMITTED:
        season, week, away, home = g["game_id"].split("_")
        assert (int(season), int(week), away, home) == (g["season"], g["week"], g["away_team_id"], g["home_team_id"])
        assert not set(g) & {"spread_line", "total_line", "home_moneyline", "away_moneyline"}


@pytest.fixture(scope="module")
def nflverse_schedules():
    try:
        return bgf.load_nflverse_schedules({g["season"] for g in COMMITTED})
    except Exception as exc:  # network
        if os.environ.get("CI"):
            raise  # in CI the check is mandatory
        pytest.skip(f"nflverse unreachable: {exc}")


def test_every_score_week_and_date_matches_nflverse(nflverse_schedules):
    live = {g["game_id"]: g for g in bgf.facts_from_schedules(nflverse_schedules)}
    for g in COMMITTED:
        for key in ("week", "game_date", "home_team_id", "away_team_id", "home_score", "away_score", "overtime", "season_type"):
            assert g[key] == live[g["game_id"]][key], f"{g['game_id']} {key}: {g[key]!r} != nflverse {live[g['game_id']][key]!r}"


def test_known_results():
    by = {g["game_id"]: g for g in COMMITTED}
    assert (by["2023_01_DET_KC"]["away_score"], by["2023_01_DET_KC"]["home_score"]) == (21, 20)
    b = by["2023_01_BUF_NYJ"]
    assert (b["week"], b["game_date"], b["home_score"], b["away_score"], b["overtime"]) == (1, "2023-09-11", 22, 16, True)
