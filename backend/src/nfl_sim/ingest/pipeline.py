"""2023 (or configurable) historical PBP ingest → immutable raw + canonical lake."""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pandas as pd
import requests

from nfl_sim.config import Settings, settings
from nfl_sim.ingest.manifest import (
    PINNED_SEASON_ROW_COUNTS,
    PINNED_SEASON_SHA256,
    PBP_RELEASE_URL_TEMPLATE,
    TIMESTAMP_JSON_URL,
    SeasonManifest,
    sha256_file,
    utc_now_iso,
)
from nfl_sim.ingest.project import project_games, project_plays
from nfl_sim.store.duckdb_store import build_duckdb, write_canonical_parquet


@dataclass
class IngestResult:
    season: int
    raw_path: Path
    manifest_path: Path
    games_parquet: Path
    plays_parquet: Path
    duckdb_path: Path
    row_count: int
    game_count: int
    file_sha256: str
    sha256_matches_pin: bool | None


def _fetch_timestamp_json(timeout: float = 30.0) -> dict[str, Any] | None:
    try:
        resp = requests.get(TIMESTAMP_JSON_URL, timeout=timeout)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


def download_season_parquet(
    season: int,
    dest: Path,
    *,
    cache_dir: Path,
    timeout: float = 120.0,
) -> Path:
    """Download season PBP via nflreadpy (preferred) or direct URL fallback.

    Writes an immutable copy under dest. Refuses to overwrite an existing file
    with different bytes (immutable raw policy).
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    url = PBP_RELEASE_URL_TEMPLATE.format(season=season)

    import nflreadpy as nfl
    from nflreadpy.config import update_config

    cache_dir.mkdir(parents=True, exist_ok=True)
    update_config(
        cache_mode="filesystem",
        cache_dir=cache_dir,  # Path required in 0.1.5
        cache_duration=86400,
    )
    frame = nfl.load_pbp([season])
    # nflreadpy returns Polars; convert for pandas lake writers
    if hasattr(frame, "to_pandas"):
        pdf = frame.to_pandas()
    else:
        pdf = pd.DataFrame(frame)

    tmp = dest.with_suffix(dest.suffix + ".tmp")
    pdf.to_parquet(tmp, index=False)

    if dest.exists():
        existing = sha256_file(dest)
        new_hash = sha256_file(tmp)
        if existing != new_hash:
            tmp.unlink(missing_ok=True)
            raise FileExistsError(
                f"Immutable raw refuses overwrite: {dest} sha256={existing} "
                f"new={new_hash}. Delete manually only if intentional re-pin."
            )
        tmp.unlink(missing_ok=True)
        return dest

    tmp.replace(dest)
    # Touch URL provenance sidecar for operators (manifest is authoritative)
    (dest.parent / "SOURCE_URL.txt").write_text(url + "\n")
    return dest


def ingest_season(
    season: int = 2023,
    *,
    cfg: Settings | None = None,
    force_rebuild_canonical: bool = True,
) -> IngestResult:
    """Ingest one season into raw + canonical Parquet + DuckDB."""
    cfg = cfg or settings
    raw_dir = cfg.raw_dir / "pbp" / f"season={season}"
    raw_path = raw_dir / "play_by_play.parquet"
    manifest_path = raw_dir / "manifest.json"

    package_version = "0.1.5"
    try:
        import nflreadpy as nfl

        package_version = getattr(nfl, "__version__", package_version)
    except Exception:
        pass

    retrieval_ts = utc_now_iso()
    download_season_parquet(
        season,
        raw_path,
        cache_dir=cfg.nflreadpy_cache_dir,
    )

    file_hash = sha256_file(raw_path)
    file_bytes = raw_path.stat().st_size
    pbp = pd.read_parquet(raw_path)
    row_count = int(len(pbp))

    pinned = PINNED_SEASON_SHA256.get(season)
    matches = (file_hash == pinned) if pinned else None
    notes: list[str] = [
        "Raw Parquet is immutable once written; sha mismatch blocks overwrite.",
        "Published ep/epa/wp are stored as reference_* in canonical plays.",
        "CC BY 4.0 attribution: nflverse play-by-play.",
    ]
    if pinned and not matches:
        notes.append(
            f"WARNING: sha256 {file_hash} differs from pin {pinned} "
            "(nflverse tag pbp is mutable)."
        )
    expected_rows = PINNED_SEASON_ROW_COUNTS.get(season)
    if expected_rows is not None and row_count != expected_rows:
        notes.append(
            f"WARNING: row_count {row_count} differs from pinned {expected_rows}."
        )

    manifest = SeasonManifest(
        season=season,
        source_url=PBP_RELEASE_URL_TEMPLATE.format(season=season),
        retrieval_timestamp_utc=retrieval_ts,
        package="nflreadpy",
        package_version=package_version,
        file_sha256=file_hash,
        file_bytes=file_bytes,
        dataset_row_count=row_count,
        pinned_sha256=pinned,
        sha256_matches_pin=matches,
        nflverse_timestamp_json=_fetch_timestamp_json(),
        raw_path=str(raw_path.relative_to(cfg.data_dir.parent))
        if raw_path.is_relative_to(cfg.data_dir.parent)
        else str(raw_path),
        notes=notes,
    )
    manifest.write(manifest_path)

    games = project_games(pbp)
    plays = project_plays(pbp)

    games_path, plays_path = write_canonical_parquet(
        games,
        plays,
        season=season,
        parquet_dir=cfg.parquet_dir,
        overwrite=force_rebuild_canonical,
    )
    duckdb_path = build_duckdb(
        games_glob=str(cfg.parquet_dir / "games" / "season=*" / "games.parquet"),
        plays_glob=str(cfg.parquet_dir / "plays" / "season=*" / "plays.parquet"),
        duckdb_path=cfg.duckdb_path,
        manifests_dir=cfg.raw_dir / "pbp",
    )

    # Copy season manifest into canonical for API health
    canon_manifest = cfg.parquet_dir / f"manifest_season_{season}.json"
    shutil.copy2(manifest_path, canon_manifest)

    return IngestResult(
        season=season,
        raw_path=raw_path,
        manifest_path=manifest_path,
        games_parquet=games_path,
        plays_parquet=plays_path,
        duckdb_path=duckdb_path,
        row_count=row_count,
        game_count=int(len(games)),
        file_sha256=file_hash,
        sha256_matches_pin=matches,
    )


def load_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text())
