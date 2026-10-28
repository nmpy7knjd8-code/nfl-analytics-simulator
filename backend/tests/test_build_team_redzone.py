"""mining/build_team_redzone.py: F5 teamRedzone.json (nflverse drive results, REG only, frozen numbers)."""
from __future__ import annotations

import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location("build_team_redzone", ROOT / "mining/build_team_redzone.py")
br = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(br)

SITE = ROOT / "frontend/lib/teamRedzone.json"
BANNED_KEY = re.compile(r"epa|xpass|play_id|wpa|vegas|spread|odds", re.I)


def row(game, team, drive, result, yl, play_type="pass", season_type="REG"):
    return {"game_id": game, "season": 2024, "season_type": season_type, "posteam": team, "fixed_drive": drive,
            "fixed_drive_result": result, "yardline_100": yl, "play_type": play_type}


ROWS = [
    row("g1", "KC", 1, "Touchdown", 35), row("g1", "KC", 1, "Touchdown", 12), row("g1", "KC", 1, "Touchdown", 3),
    row("g1", "KC", 2, "Field goal", 18), row("g1", "KC", 2, "Field goal", 18, "field_goal"),
    row("g1", "KC", 3, "Opp touchdown", 9),            # pick-six in the red zone: trip, 0 points
    row("g1", "KC", 4, "Punt", 40),                     # never reached the 20
    row("g1", "KC", 5, "Touchdown", 15, "extra_point"),  # PAT is not a snap
    row("g1", "BUF", 1, "Missed field goal", 20, "field_goal"),
    row("g2", "KC", 1, "Touchdown", 5, season_type="POST"),  # playoffs excluded
]


def test_counts_from_nflverse_drive_results():
    out = br.build(ROWS)
    kc = next(t for t in out["teams"] if t["team"] == "KC")
    buf = next(t for t in out["teams"] if t["team"] == "BUF")
    assert (kc["drives"], kc["td"], kc["fg"], kc["no_score"]) == (3, 1, 1, 1)
    assert (buf["drives"], buf["td"], buf["fg"], buf["no_score"]) == (1, 0, 0, 1)
    assert out["league"] == {"drives": 4, "td": 1, "td_rate": 0.25}
    assert out["season_type"] == "REG" and out["seasons"] == [2024, 2024]


def test_ranks_ties_share_lower_rank():
    out = br.build(ROWS)
    ranks = {t["team"]: t["rank"] for t in out["teams"]}
    assert ranks["KC"] == 1 and ranks["BUF"] == 2 and ranks["NYJ"] == 2


def test_frozen_numbers():
    old = br.build(ROWS)
    assert br.check_frozen(old, br.build(ROWS)) == []
    changed = br.build([r for r in ROWS if r["fixed_drive"] != 3])
    assert "KC" in br.check_frozen(old, changed) and "league" in br.check_frozen(old, changed)
    later = br.build(ROWS + [dict(row("g3", "KC", 1, "Touchdown", 4), season=2025)])
    assert br.check_frozen(old, later) == []  # new season may change totals


def test_committed_file_invariants():
    f = json.loads(SITE.read_text())
    assert f["schema_version"] == 1 and f["stub"] is False and f["season_type"] == "REG"
    assert len(f["teams"]) == 32 and {t["team"] for t in f["teams"]} == br.TEAMS
    for t in f["teams"]:
        assert t["td"] + t["fg"] + t["no_score"] == t["drives"]
        assert t["td_rate"] == round(t["td"] / t["drives"], 4) and 1 <= t["rank"] <= 32
    assert f["league"]["drives"] == sum(t["drives"] for t in f["teams"])
    assert f["league"]["td"] == sum(t["td"] for t in f["teams"])
    assert f["league"]["td_rate"] == round(f["league"]["td"] / f["league"]["drives"], 4)
    assert SITE.stat().st_size < 8_000
    keys = set(f) | set(f["league"]) | {k for t in f["teams"] for k in t}
    assert not [k for k in keys if BANNED_KEY.search(k)]
