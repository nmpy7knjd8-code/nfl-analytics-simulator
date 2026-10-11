"""CLI: python -m nfl_sim.ingest [--season 2023] [--seasons 2019,2020,2021,2022]."""

from __future__ import annotations

import argparse
import json
import sys

from nfl_sim.ingest.pipeline import ingest_season


def _parse_seasons(args: argparse.Namespace) -> list[int]:
    if args.seasons:
        out: list[int] = []
        for part in args.seasons.split(","):
            part = part.strip()
            if not part:
                continue
            out.append(int(part))
        if not out:
            raise SystemExit("--seasons was empty")
        return out
    return [int(args.season)]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Ingest nflverse PBP into canonical lake")
    parser.add_argument(
        "--season",
        type=int,
        default=2023,
        help="Single season to ingest (default 2023)",
    )
    parser.add_argument(
        "--seasons",
        type=str,
        default=None,
        help="Comma-separated seasons (overrides --season), e.g. 2019,2020,2021,2022",
    )
    args = parser.parse_args(argv)
    seasons = _parse_seasons(args)
    results = []
    for season in seasons:
        result = ingest_season(season)
        results.append(
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
            }
        )
    payload = results[0] if len(results) == 1 else {"seasons": results}
    print(json.dumps(payload, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
