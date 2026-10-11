"""Provenance manifest for immutable raw season artifacts."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# Tag `pbp` is mutable. Phase 1 DATA_EXPERIMENT (2026-10-11) recorded
# bd3484731408def6b0ec93225bba2bd7b2c65769ca707a2b9444d891abdc6776 (20,534,088 bytes).
# Phase 2 re-download (2026-10-11 later) observed a new digest with the same row count.
PINNED_SEASON_SHA256: dict[int, str] = {
    2023: "b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d",
}

PREVIOUS_PINNED_SEASON_SHA256: dict[int, str] = {
    2023: "bd3484731408def6b0ec93225bba2bd7b2c65769ca707a2b9444d891abdc6776",
}

PINNED_SEASON_ROW_COUNTS: dict[int, int] = {
    2023: 49_665,
}

PBP_RELEASE_URL_TEMPLATE = (
    "https://github.com/nflverse/nflverse-data/releases/download/pbp/"
    "play_by_play_{season}.parquet"
)

TIMESTAMP_JSON_URL = (
    "https://github.com/nflverse/nflverse-data/releases/download/pbp/timestamp.json"
)


def sha256_file(path: Path, chunk_size: int = 1 << 20) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


@dataclass
class SeasonManifest:
    season: int
    source_url: str
    retrieval_timestamp_utc: str
    package: str
    package_version: str
    file_sha256: str
    file_bytes: int
    dataset_row_count: int
    pinned_sha256: str | None
    sha256_matches_pin: bool | None
    nflverse_timestamp_json: dict[str, Any] | None
    raw_path: str
    notes: list[str]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def write(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2, sort_keys=True) + "\n")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()
