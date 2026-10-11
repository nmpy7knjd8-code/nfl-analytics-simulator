"""Integration: real 2023 ingest + known source record checks.

Requires network on first run. Reuses immutable raw if already present.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from nfl_sim.config import Settings, settings
from nfl_sim.ingest.manifest import (
    PINNED_SEASON_ROW_COUNTS,
    PINNED_SEASON_SHA256,
    PREVIOUS_PINNED_SEASON_SHA256,
    sha256_file,
)
from nfl_sim.ingest.pipeline import ingest_season
from nfl_sim.store import CanonicalStore

# Known historical opener: DET @ KC, 2023 Week 1 (nflverse game_id)
KNOWN_GAME_ID = "2023_01_DET_KC"


@pytest.fixture(scope="module")
def real_ingest_result():
    """Ingest 2023 into the project data lake (idempotent for matching raw)."""
    # Use project settings so the app can share the lake during manual demos
    return ingest_season(2023, cfg=settings, force_rebuild_canonical=True)


@pytest.mark.integration
def test_2023_ingest_matches_pinned_source_record(real_ingest_result):
    result = real_ingest_result
    assert result.row_count == PINNED_SEASON_ROW_COUNTS[2023]
    assert result.file_sha256 == PINNED_SEASON_SHA256[2023]
    assert result.sha256_matches_pin is True
    # Prove we still know the Phase 1 digest drifted (mutable release tag)
    assert result.file_sha256 != PREVIOUS_PINNED_SEASON_SHA256[2023]
    assert sha256_file(result.raw_path) == result.file_sha256

    manifest = json.loads(result.manifest_path.read_text())
    assert manifest["package"] == "nflreadpy"
    assert manifest["package_version"] == "0.1.5"
    assert manifest["season"] == 2023
    assert "releases/download/pbp/play_by_play_2023.parquet" in manifest["source_url"]
    assert manifest["retrieval_timestamp_utc"]
    assert manifest["dataset_row_count"] == PINNED_SEASON_ROW_COUNTS[2023]
    assert Path(result.raw_path).exists()
    assert result.game_count >= 270  # REG+POST; REG alone is 272


@pytest.mark.integration
def test_stable_ids_and_complete_known_game_replay(real_ingest_result):
    store = CanonicalStore(settings)
    game = store.get_game(KNOWN_GAME_ID)
    assert game is not None, f"expected known game {KNOWN_GAME_ID} in 2023 lake"
    assert str(game["home_team_id"]) == "KC"
    assert str(game["away_team_id"]) == "DET"
    assert int(game["season"]) == 2023
    assert int(game["week"]) == 1

    plays, total = store.list_plays(KNOWN_GAME_ID, limit=2000, offset=0)
    assert total > 100
    assert len(plays) == total
    indexes = [int(p["play_index"]) for p in plays]
    assert indexes == list(range(total))
    play_ids = [str(p["play_id"]) for p in plays]
    assert len(play_ids) == len(set(play_ids))

    # At least one scrimmage play with conventions
    scrimmage = next(p for p in plays if p.get("down") is not None and p.get("down") == p.get("down"))
    # duckdb may return numpy types
    down = int(scrimmage["down"])
    assert 1 <= down <= 4
    y100 = scrimmage["yardline_100"]
    assert y100 is not None and 1 <= int(y100) <= 99
    assert scrimmage["half_seconds_remaining"] is not None
    # Reference columns namespaced / present on many rows
    assert any(p.get("reference_ep") is not None and p.get("reference_ep") == p.get("reference_ep") for p in plays)


@pytest.mark.integration
def test_raw_immutable_refuses_different_bytes(tmp_path, real_ingest_result):
    cfg = Settings(
        data_dir=tmp_path / "data",
        duckdb_path=tmp_path / "data" / "canonical" / "nfl.duckdb",
        parquet_dir=tmp_path / "data" / "canonical" / "parquet",
        raw_dir=tmp_path / "data" / "raw",
        nflreadpy_cache_dir=tmp_path / ".cache" / "nflreadpy",
    )
    # First write
    ingest_season(2023, cfg=cfg)
    raw = cfg.raw_dir / "pbp" / "season=2023" / "play_by_play.parquet"
    # Corrupt / replace with different content then ensure second ingest refuses overwrite
    raw.write_bytes(b"not-a-parquet")
    with pytest.raises(FileExistsError):
        # download writes tmp then compares — different hash must refuse
        from nfl_sim.ingest.pipeline import download_season_parquet

        download_season_parquet(2023, raw, cache_dir=cfg.nflreadpy_cache_dir)
