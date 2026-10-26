"""Shared fixtures — synthetic lake for API tests; optional real 2023 lake."""

from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from nfl_sim.config import Settings
from nfl_sim.ingest.project import project_games, project_plays
from nfl_sim.store.duckdb_store import build_duckdb, write_canonical_parquet


@pytest.fixture
def tmp_settings(tmp_path: Path) -> Settings:
    data = tmp_path / "data"
    return Settings(
        data_dir=data,
        duckdb_path=data / "canonical" / "nfl.duckdb",
        parquet_dir=data / "canonical" / "parquet",
        raw_dir=data / "raw",
        nflreadpy_cache_dir=tmp_path / ".cache" / "nflreadpy",
    )


@pytest.fixture
def synthetic_pbp() -> pd.DataFrame:
    rows = []
    for i, (down, y100, desc, ptype) in enumerate(
        [
            (None, None, "Kickoff", "kickoff"),
            (1, 75, "Pass complete", "pass"),
            (2, 68, "Run left", "run"),
            (3, 65, "Incomplete", "pass"),
            (4, 65, "Punt", "punt"),
        ],
        start=1,
    ):
        rows.append(
            {
                "game_id": "2023_01_DET_KC",
                "play_id": i * 10,
                "season": 2023,
                "week": 1,
                "season_type": "REG",
                "game_type": "REG",
                "game_date": "2023-09-07",
                "home_team": "KC",
                "away_team": "DET",
                "roof": "outdoors",
                "surface": "grass",
                "stadium": "GEHA Field at Arrowhead Stadium",
                "home_opening_kickoff": 1,
                "home_score": 20,
                "away_score": 21,
                "qtr": 1,
                "half_seconds_remaining": 1800 - i * 40,
                "game_seconds_remaining": 3600 - i * 40,
                "down": down,
                "ydstogo": 10 if down else None,
                "yardline_100": y100,
                "posteam": None if down is None else "DET",
                "defteam": None if down is None else "KC",
                "score_differential": 0 if down else None,
                "posteam_score": 0 if down else None,
                "defteam_score": 0 if down else None,
                "posteam_timeouts_remaining": 3 if down else None,
                "defteam_timeouts_remaining": 3 if down else None,
                "play_type": ptype,
                "desc": desc,
                "yards_gained": 0.0,
                "score_differential_post": 0,
                "posteam_score_post": 0,
                "defteam_score_post": 0,
                "fixed_drive": 1,
                "fixed_drive_result": "Punt",
                "ep": 0.1 * i,
                "epa": 0.01,
                "wp": 0.5,
                "wpa": 0.0,
                "vegas_wp": 0.55,
                "vegas_wpa": 0.0,
                "home_wp": 0.5,
                "away_wp": 0.5,
                "cp": None,
                "success": 0.0,
                "sp": 0,
                "interception": 0,
                "fumble_lost": 0,
            }
        )
    # Second game for list coverage
    rows.append(
        {
            **rows[0],
            "game_id": "2023_01_BUF_NYJ",
            "play_id": 1,
            "week": 1,
            "home_team": "NYJ",
            "away_team": "BUF",
            "game_date": "2023-09-11",
            "home_score": 22,
            "away_score": 16,
            "desc": "Kickoff BUF@NYJ",
        }
    )
    return pd.DataFrame(rows)


@pytest.fixture
def synthetic_store(tmp_settings: Settings, synthetic_pbp: pd.DataFrame) -> Settings:
    games = project_games(synthetic_pbp)
    plays = project_plays(synthetic_pbp)
    write_canonical_parquet(
        games,
        plays,
        season=2023,
        parquet_dir=tmp_settings.parquet_dir,
    )
    build_duckdb(
        games_glob=str(tmp_settings.parquet_dir / "games" / "season=*" / "games.parquet"),
        plays_glob=str(tmp_settings.parquet_dir / "plays" / "season=*" / "plays.parquet"),
        duckdb_path=tmp_settings.duckdb_path,
    )
    return tmp_settings
