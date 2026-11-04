"""Regression: every FG-distance path uses FG_SNAP_YARDS (= nflverse yardline_100 + 18)."""
import re
from pathlib import Path

from nfl_sim.models.fourth_down import FourthDownSituation, kick_distance
from nfl_sim.models.fourth_down_empirics import FG_SNAP_YARDS

REPO = Path(__file__).resolve().parents[2]


def _sit(yl):
    return FourthDownSituation(yardline_100=yl, distance=4, score_differential=0,
                               game_seconds_remaining=600, half_seconds_remaining=600)


def test_constant_matches_nflverse():
    assert FG_SNAP_YARDS == 18


def test_analyzer_kick_distance_uses_constant():
    for yl in (1, 20, 36, 46, 47):
        assert kick_distance(_sit(yl)) == yl + FG_SNAP_YARDS
    assert kick_distance(_sit(46)) == 64  # longest kick still offered
    assert kick_distance(_sit(47)) == 65  # first one dropped


def test_no_hardcoded_fg_offset_in_engine_code():
    pat = re.compile(r"yardline_100\s*\+\s*1[78]\b")
    for p in [*(REPO / "backend/src").rglob("*.py"), *(REPO / "backend/scripts").rglob("*.py")]:
        for n, line in enumerate(p.read_text().splitlines(), 1):
            code = line.split("#", 1)[0]
            if code.lstrip().startswith(("\"", "'")) or "FG distance =" in code:
                continue  # prose / docstrings
            assert not pat.search(code), f"{p}:{n}: {line}"
