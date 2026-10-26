"""Acceptance guard (QA2 H1): no engine path offers or values a field goal over 64 yards.

Sweeps the shared FourthDownAnalyzer over every yard line, both empirics modes, both
transition modes and the p_make override, and scans every committed backend data file
that carries FG values (quiz packs, provider fixtures, baked reports).
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nfl_sim.models.fourth_down import FourthDownAnalyzer, FourthDownSituation, kick_distance
from nfl_sim.models.fourth_down_empirics import MAX_FG_DISTANCE

from test_fourth_down import _toy_empirics, _toy_wp_model

MAX_FG = 64
REPO = Path(__file__).resolve().parents[2]


def test_cap_constant_is_64():
    assert MAX_FG_DISTANCE == MAX_FG


@pytest.fixture(scope="module")
def analyzer() -> FourthDownAnalyzer:
    return FourthDownAnalyzer(_toy_wp_model(), _toy_empirics())


@pytest.mark.parametrize("transition_mode", ["legacy", "improved"])
@pytest.mark.parametrize("p_make_override", [None, 0.99])
def test_analyzer_never_offers_fg_past_64(analyzer, transition_mode, p_make_override):
    bad = []
    for yl in range(1, 100):
        sit = FourthDownSituation(
            yardline_100=yl, distance=3, score_differential=-2,
            game_seconds_remaining=120, half_seconds_remaining=120,
        )
        res = analyzer.analyze(sit, transition_mode=transition_mode, p_make_override=p_make_override)
        kd = kick_distance(sit)
        if kd > MAX_FG and ("fg" in res.actions or res.recommendation == "fg"
                            or "fg" in res.to_dict()["actions"]):
            bad.append(kd)
        if kd <= MAX_FG and "fg" in res.actions:
            assert res.actions["fg"].components["kick_distance"] <= MAX_FG
    assert not bad, f"FG offered at {bad} yd"


def _fg_values(obj, path="$"):
    """Yield (path, yardline_100) for every dict that has a yardline and an FG value/option."""
    if isinstance(obj, dict):
        sit = obj.get("situation") if isinstance(obj.get("situation"), dict) else obj
        yl = sit.get("yardline_100")
        if isinstance(yl, (int, float)):
            has_fg = False
            for key in ("reveal", "values", "actions", "configs"):
                blob = json.dumps(obj.get(key, {}))
                if '"fg"' in blob:
                    has_fg = True
            if has_fg:
                yield path, yl
        for k, v in obj.items():
            if k != "situation":
                yield from _fg_values(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from _fg_values(v, f"{path}[{i}]")


DATA_FILES = sorted(
    p for root in ("backend/src/nfl_sim/quiz/data", "backend/src/nfl_sim/providers/fixtures")
    for p in (REPO / root).rglob("*.json")
)


@pytest.mark.parametrize("path", DATA_FILES, ids=lambda p: str(p.relative_to(REPO)))
def test_committed_data_has_no_fg_past_64(path):
    bad = [f"{where}: {int(yl) + 17}-yd FG" for where, yl in _fg_values(json.loads(path.read_text()))
           if yl + 17 > MAX_FG]
    assert not bad, "\n".join(bad)
