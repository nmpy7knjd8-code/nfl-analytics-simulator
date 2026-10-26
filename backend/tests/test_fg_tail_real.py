"""FG make tail vs real nflverse kicks (lake required; skips in CI without it)."""
from __future__ import annotations

import pandas as pd
import pytest

from nfl_sim.models import fourth_down_empirics as fde

try:
    PBP = fde.load_raw_seasons((2019, 2020, 2021, 2022, 2023, 2024, 2025))
except Exception:  # pragma: no cover - lake missing
    PBP = None
pytestmark = pytest.mark.skipif(PBP is None, reason="nflverse lake not available")


def _fg(df):
    m = df["play_type"].astype("string").eq("field_goal") & df["season_type"].astype("string").eq("REG")
    return df[m]


@pytest.mark.parametrize("game_id,dist", [("2025_09_JAX_LV", 68), ("2025_18_TEN_JAX", 67)])
def test_real_long_makes_stay_in_the_facts(game_id, dist):
    f = _fg(PBP)
    hit = f[(f["game_id"] == game_id) & (f["kick_distance"] == dist)]
    assert len(hit) == 1
    r = hit.iloc[0]
    assert r["field_goal_result"] == "made" and r["kicker_player_name"] == "C.Little"


def test_fitted_tail_reaches_the_longest_training_attempt():
    emp = fde.FourthDownEmpirics.fit_from_seasons()
    train = _fg(PBP[PBP["season"].isin(emp.meta.get("seasons", [2019, 2020, 2021, 2022]))])
    longest = int(pd.to_numeric(train["kick_distance"]).max())
    assert max(k[1] for k in emp.fg_by_kick_distance) == longest  # derived, not a hardcoded 66
    for kd in range(65, longest + 1):
        p, meta = emp.p_make(kd)
        assert 0.0 < p < emp.p_make(60)[0] and meta["out_of_range"]  # priced, never offered
    assert emp.p_make(64)[1].get("out_of_range") is None
    assert emp.p_make(longest + 1)[0] == 0.0
