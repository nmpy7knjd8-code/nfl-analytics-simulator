"""Real past plays use nflverse's published WP; our model only where it is null (flagged)."""
import pandas as pd

from nfl_sim.models.past_play_wp import past_play_home_wp
from nfl_sim.products import games


def _rows():
    return pd.DataFrame({
        "game_id": ["g"] * 3, "play_id": [1.0, 2.0, 3.0], "qtr": [1, 4, 4],
        "quarter_seconds_remaining": [900, 30, 0], "game_seconds_remaining": [3600, 30, 0],
        "half_seconds_remaining": [1800, 30, 0], "posteam": ["KC", "DET", "DET"], "defteam": ["DET", "KC", "KC"],
        "home_team": ["KC"] * 3, "down": [1, 1, None], "ydstogo": [10, 10, None], "yardline_100": [75, 70, None],
        "score_differential": [0, 1, 1], "posteam_timeouts_remaining": [3, 1, 1], "defteam_timeouts_remaining": [3, 0, 0],
        "desc": ["kickoff", "kneel", "END GAME"], "play_type": ["kickoff", "qb_kneel", None],
        "total_home_score": [0, 20, 20], "total_away_score": [0, 21, 21],
        "vegas_wp": [0.64, 0.97, None], "vegas_home_wp": [0.64, 0.03, 0.02], "vegas_home_wpa": [0.01, -0.01, None],
    })


def test_uses_nflverse_wp_and_flags_model_fallback():
    out = past_play_home_wp(_rows())
    assert out["home_wp"].iloc[:2].tolist() == [0.64, 0.03]
    assert abs(out["home_wp_post"].iloc[0] - 0.65) < 1e-9
    assert out["wp_fallback"].tolist() == [False, False, True]
    assert out["home_wp"].iloc[2] != 0.02 and 0 <= out["home_wp"].iloc[2] < 0.5  # our model, away leads at 0:00


def test_game_file_lists_fallback_rows():
    game = {"id": "g", "season": 2023, "season_type": "REG", "home": "KC", "away": "DET",
            "home_score": 20, "away_score": 21}
    doc = games.game_doc(game, _rows(), {}, {"source": "nflverse"})
    assert doc["wp_fallback_play_ids"] == [3]
    assert doc["plays"][0]["home_wp"] == 0.64
