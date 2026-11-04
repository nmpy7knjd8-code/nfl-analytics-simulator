"""WP quirk flags (OT / end of half) and our own WP model's OT behavior.

nflverse `home_wp` put KC at 1.1% before SF's OT field goal in Super Bowl LVIII,
even though the playoff rule guaranteed KC a possession. A FG on the first OT
possession never ends the game under 2019–25 rules (REG: modified sudden death
through 2023, both-possess from 2024; POST: both-possess from 2022 and the FG
exception before), so P(kicking team wins) right before that FG must stay well
below "certain".
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from nfl_sim.config import REPO_ROOT
from nfl_sim.models.wp_series import build_wp_series, wp_quirk_reason

GAME = {"game_id": "g", "home_team_id": "KC", "away_team_id": "SF", "home_score": 25, "away_score": 22,
        "season_type": "POST"}


def _play(i, q, gsr, hw):
    return {"play_id": str(i), "play_index": i, "quarter": q, "game_seconds_remaining": gsr,
            "reference": {"home_wp": hw}}


@pytest.mark.parametrize("q,elapsed,want", [(1, 100, None), (2, 1679, None), (2, 1680, "end_of_half"),
                                            (3, 1800, None), (4, 3479, None), (4, 3480, "low_clock_before_half"),
                                            (5, 3700, "overtime")])
def test_quirk_reason(q, elapsed, want):
    assert wp_quirk_reason(q, elapsed) == want


def test_story_ranking_excludes_end_of_half_and_downweights_ot():
    plays = [_play(0, 2, 1830, 0.50),   # Q2 0:30 → end_of_half, swing of 40 excluded
             _play(1, 3, 1500, 0.90),   # normal, swing −10
             _play(2, 3, 1400, 0.80),   # normal, swing +12
             _play(3, 5, 445, 0.92),    # OT swing −81 × 0.5 = 40.5
             _play(4, 5, 442, 0.11)]
    s = build_wp_series(GAME, plays, swing_threshold=0.08)
    by = {p.play_id: p for p in s.points}
    assert by["0"].is_end_of_half and by["0"].story_weight == 0 and by["0"].is_swing
    assert by["3"].wp_quirk_reason == "overtime" and by["3"].story_weight == 0.5
    assert "0" in s.swing_play_ids and "0" not in s.story_swing_play_ids
    # final OT point is forced to the result (0.11 → 1.0): 0.89 × 0.5 beats play 3 (0.81 × 0.5)
    assert s.story_swing_play_ids[:2] == ["4", "3"] and set(s.story_swing_play_ids) == {"1", "2", "3", "4"}


def _pbp(season):
    p = REPO_ROOT / "data" / "raw" / "pbp" / f"season={season}" / "play_by_play.parquet"
    if not p.exists():
        pytest.skip("nflverse lake not present")
    return pd.read_parquet(p)


def _sb58_pre_fg():
    g = _pbp(2023)
    return g[(g["game_id"] == "2023_22_SF_KC") & (g["play_id"] == 4525)]


def test_nflverse_sb58_ot_quirk_is_real_and_flagged():
    row = _sb58_pre_fg()
    assert float(row["home_wp"].iloc[0]) < 0.02  # KC "1.1%" before SF's OT FG
    assert wp_quirk_reason(5, 3600 + 900 - 445) == "overtime"


def _our_model():
    from nfl_sim.models.wp_model import WPModel
    path = REPO_ROOT / "reports" / "wp" / "artifacts" / "wp_model.joblib"
    if not path.exists():
        pytest.skip("WP artifact not present (gitignored)")
    return WPModel.load(path)


@pytest.mark.parametrize("season_type,season", [("POST", 2023), ("REG", 2023), ("REG", 2024), ("REG", 2021)])
def test_our_model_does_not_treat_first_possession_ot_fg_as_game_over(season_type, season):
    """Same board under each rule set: kicking team before a 1st-possession OT FG."""
    m = _our_model()
    row = _sb58_pre_fg().copy()
    row["season_type"], row["season"] = season_type, season
    if season_type == "REG":  # REG OT is 10 min: same 7:25 left in the period
        row["game_seconds_remaining"] = 445.0
    p = float(m.predict_wp(row)[0])
    assert 0.35 <= p <= 0.85, p


def test_our_model_ot_brier_not_worse_than_nflverse():
    import numpy as np
    m = _our_model()
    frames = []
    for s in range(2019, 2026):
        g = _pbp(s)
        frames.append(g[(g["qtr"] == 5) & g["down"].notna() & g["wp"].notna() & g["posteam"].notna()
                        & (g["home_score"] != g["away_score"])])
    ot = pd.concat(frames)
    winner = np.where(ot["home_score"] > ot["away_score"], ot["home_team"], ot["away_team"])
    won = (ot["posteam"].to_numpy() == winner).astype(float)
    ours = m.predict_wp(ot)
    assert ((ours - won) ** 2).mean() <= ((ot["wp"].to_numpy() - won) ** 2).mean()
