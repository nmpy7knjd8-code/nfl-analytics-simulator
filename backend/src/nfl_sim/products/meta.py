"""Provenance block every C6 file carries: source, nflreadpy version, data hash, build date."""
from __future__ import annotations

import hashlib
import json
import os
from datetime import date
from importlib.metadata import PackageNotFoundError, version
from typing import Any

from nfl_sim.config import REPO_ROOT

PRODUCTS_DIR = REPO_ROOT / "frontend" / "public" / "data"
RAW_PBP = REPO_ROOT / "data" / "raw" / "pbp"


def nflreadpy_version() -> str:
    try:
        return version("nflreadpy")
    except PackageNotFoundError:
        return "unknown"


def season_hashes(seasons) -> dict[str, str]:
    out = {}
    for s in sorted(set(int(x) for x in seasons)):
        m = json.loads((RAW_PBP / f"season={s}" / "manifest.json").read_text())
        out[str(s)] = m["file_sha256"]
    return out


def provenance(seasons, *, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    hashes = season_hashes(seasons)
    combined = hashlib.sha256("|".join(f"{k}:{v}" for k, v in sorted(hashes.items())).encode()).hexdigest()
    return {
        "source": "nflverse",
        "nflreadpy_version": nflreadpy_version(),
        "data_sha256": combined,
        "season_sha256": hashes,
        "build_date": os.environ.get("NFL_SIM_BUILD_DATE") or date.today().isoformat(),
        "license": "nflverse play-by-play, CC BY 4.0",
        **(extra or {}),
    }


def write_json(rel: str, doc: dict[str, Any]) -> None:
    path = PRODUCTS_DIR / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
