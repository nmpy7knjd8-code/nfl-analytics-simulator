"""Derived field + play-type mapping unit tests (no network)."""

import pandas as pd

from nfl_sim.contracts.enums import PlayType
from nfl_sim.ingest.derive import derive_is_home_possession, derive_receive_2h_ko
from nfl_sim.ingest.play_types import map_play_type
from nfl_sim.ingest.project import project_plays


def test_map_play_type_known_and_missing():
    assert map_play_type("pass") is PlayType.PASS
    assert map_play_type("run") is PlayType.RUSH
    assert map_play_type(None) is PlayType.OTHER
    assert map_play_type("mystery") is PlayType.OTHER


def test_is_home_possession_and_nulls():
    posteam = pd.Series(["KC", None, "DET"])
    home = pd.Series(["DET", "DET", "DET"])
    out = derive_is_home_possession(posteam, home)
    assert bool(out.iloc[0]) is False
    assert pd.isna(out.iloc[1])
    assert bool(out.iloc[2]) is True


def test_receive_2h_ko_nflfastr_rule():
    # First non-null defteam in first half is DET → DET receives 2H KO
    df = pd.DataFrame(
        {
            "game_id": ["g1"] * 4,
            "qtr": [1, 1, 2, 3],
            "posteam": ["KC", "DET", "KC", "DET"],
            "defteam": ["DET", "KC", "DET", "KC"],
        }
    )
    flags = derive_receive_2h_ko(df)
    assert int(flags.iloc[0]) == 0  # KC has ball; DET receives 2H
    assert int(flags.iloc[1]) == 1
    assert int(flags.iloc[2]) == 0
    assert pd.isna(flags.iloc[3])  # second half → null


def test_project_plays_preserves_null_down_and_orders():
    raw = pd.DataFrame(
        {
            "game_id": ["2023_01_DET_KC", "2023_01_DET_KC", "2023_01_DET_KC"],
            "play_id": [55, 40, 60],
            "qtr": [1, 1, 1],
            "half_seconds_remaining": [1800, 1700, 1600],
            "game_seconds_remaining": [3600, 3500, 3400],
            "down": [pd.NA, 1, 2],
            "ydstogo": [pd.NA, 10, 7],
            "yardline_100": [pd.NA, 75, 68],
            "posteam": [None, "DET", "DET"],
            "defteam": [None, "KC", "KC"],
            "home_team": ["KC", "KC", "KC"],
            "away_team": ["DET", "DET", "DET"],
            "score_differential": [pd.NA, 0, 0],
            "posteam_score": [pd.NA, 0, 0],
            "defteam_score": [pd.NA, 0, 0],
            "posteam_timeouts_remaining": [pd.NA, 3, 3],
            "defteam_timeouts_remaining": [pd.NA, 3, 3],
            "roof": ["outdoors", "outdoors", "outdoors"],
            "play_type": ["kickoff", "pass", "run"],
            "desc": ["Kickoff", "Complete", "Run"],
            "yards_gained": [0.0, 7.0, 3.0],
            "ep": [0.0, 1.2, 1.1],
            "epa": [0.0, 0.3, -0.1],
            "wp": [0.5, 0.52, 0.51],
            "season": [2023, 2023, 2023],
        }
    )
    plays = project_plays(raw)
    assert list(plays["play_id"].astype(str)) == ["40", "55", "60"]
    assert list(plays["play_index"]) == [0, 1, 2]
    assert pd.isna(plays.loc[plays["play_id"] == "55", "down"].iloc[0])
    # yardline_100 convention: yards from opponent EZ
    assert int(plays.loc[plays["play_id"] == "40", "yardline_100"].iloc[0]) == 75
    assert plays.loc[plays["play_id"] == "40", "reference_ep"].iloc[0] == 1.2
    assert plays.loc[plays["play_id"] == "40", "split"].iloc[0] == "test"
