"""Provenance manifest for immutable raw season artifacts."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


# Tag `pbp` is mutable. Active pins = digests in the local immutable lake after
# Phase 3 backfill (2019–2022) + Phase 2 (2023). Phase 1 DATA_EXPERIMENT digests
# are retained in PREVIOUS_PINNED_SEASON_SHA256. See docs/DATA_PIN_NOTES.md.
PINNED_SEASON_SHA256: dict[int, str] = {
    2019: "d14de5d1beebf2235040dec8f50f5cba0e4921bcf2b1a82e69c182abef16d56b",
    2020: "324cef331f3c6b91726450ef2c55f1ec8a619f23a8c4c329191ec15cdfc43b76",
    2021: "e4dd2e160522ed3534f58e788c03365ad436268605950e864663c6a5161718c8",
    2022: "e7c1b53b14afd073c209e0a90f8593058fb77c38583c4bc9593885fa67d133c7",
    # Phase 2 operational pin (unchanged through backfill).
    2023: "b8417df9501f7f966eaccfffe463425fc06153f7bd58e075f5fa8f900e67460d",
}

PREVIOUS_PINNED_SEASON_SHA256: dict[int, str] = {
    # Phase 1 DATA_EXPERIMENT (2026-10-11) — same row counts, different bytes
    2019: "60c3067017db2d28a78f66a79b657268be8578d9a5288e6a827efdcd7fe42540",
    2020: "8889f5d8782b5c5dce3c3644acdc0322b228a7e9cb13fa36cbac250e260e9f60",
    2021: "333ad34378e5339d5172717cc83378e908daf02c8699416ab3e17c2ec10f78d8",
    2022: "931121d8897779d7944e2a293e92ed8799c8e5cceef84096ac42339003fedc09",
    2023: "bd3484731408def6b0ec93225bba2bd7b2c65769ca707a2b9444d891abdc6776",
}

PINNED_SEASON_ROW_COUNTS: dict[int, int] = {
    2019: 47_260,
    2020: 47_705,
    2021: 49_922,
    2022: 49_434,
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
