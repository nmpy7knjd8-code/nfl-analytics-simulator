"""CLI: python -m nfl_sim.ingest [--season 2023]."""

from __future__ import annotations

import argparse
import json
import sys

from nfl_sim.ingest.pipeline import ingest_season


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest nflverse PBP into canonical lake")
    parser.add_argument("--season", type=int, default=2023, help="Season to ingest (Phase 2: 2023)")
    args = parser.parse_args(argv)
    result = ingest_season(args.season)
    print(
        json.dumps(
            {
                "season": result.season,
                "row_count": result.row_count,
                "game_count": result.game_count,
                "file_sha256": result.file_sha256,
                "sha256_matches_pin": result.sha256_matches_pin,
                "raw_path": str(result.raw_path),
                "manifest_path": str(result.manifest_path),
                "games_parquet": str(result.games_parquet),
                "plays_parquet": str(result.plays_parquet),
                "duckdb_path": str(result.duckdb_path),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
