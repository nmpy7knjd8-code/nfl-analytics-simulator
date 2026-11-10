"""The one season list for the Data Builders lane (mining/build_*.py, their tests, verify_rebuild.py).

CLOSED seasons (FIRST..CLOSED_THROUGH) are frozen for good (mining/_frozen.py). OPEN seasons are in
progress: they grow week by week behind the per-file watermark (mining/frozen_watermarks.json).
2026 PR3 adds 2026 to OPEN together with its first data; nothing else needs a hard-coded range.

Size caps: every lane output has a byte budget = the closed-season cap + a per-open-season allowance
(SIZE_CAPS), so a growing season raises the cap by a fixed, reviewed amount instead of an ad-hoc bump.
Per-season files (charts/<season>.json, drives/<season>.json, players/<id>.json) have a per-file cap only.
"""
from __future__ import annotations

from pathlib import Path

FIRST = 2019
CLOSED_THROUGH = 2025
OPEN: tuple[int, ...] = ()  # 2026 PR3: (2026,)

CLOSED: tuple[int, ...] = tuple(range(FIRST, CLOSED_THROUGH + 1))
SEASONS: tuple[int, ...] = CLOSED + OPEN
CLOSED_SPAN = [FIRST, CLOSED_THROUGH]  # files whose cells/totals stay the frozen closed seasons


def span() -> list[int]:
    """[first, last] of every published season (closed + open)."""
    return [SEASONS[0], SEASONS[-1]]


def season_keys(seasons: tuple[int, ...] = SEASONS) -> list[str]:
    return [str(s) for s in seasons]


def pbp_paths(pbp_dir: str | Path, seasons: tuple[int, ...] = SEASONS) -> list[str]:
    """nflverse play_by_play parquets named pbp_<season>.parquet, in season order (missing -> error)."""
    d = Path(pbp_dir)
    paths = [d / f"pbp_{s}.parquet" for s in seasons]
    missing = [str(p) for p in paths if not p.exists()]
    if missing:
        raise FileNotFoundError(f"missing pbp parquets: {missing}")
    return [str(p) for p in paths]


# repo-relative path (glob for per-season / per-player files) -> (closed-season cap, extra bytes per open season)
# Closed caps are the pre-2026 test caps, raised where a file was >= 87% full; per-open-season allowances are
# ~1.3x the file's average bytes per closed season (size / 7), rounded up. Per-season files: 0 per open season
# (a 2026 file is one season, like 2025).
SIZE_CAPS: dict[str, tuple[int, int]] = {
    "data/site/onthisday.json": (80_000, 14_000),       # 75,348 B = 94% of the old cap
    "data/site/weather.json": (45_000, 8_000),          # 40,930 B = 91%
    "data/site/twopoint.json": (170_000, 30_000),       # 157,923 B = 93%
    "data/site/firstdown.json": (45_000, 8_000),        # 40,815 B = 91%
    "data/site/fakes.json": (180_000, 31_000),          # 162,184 B = 90%
    "data/site/player_names.json": (64_000, 11_000),    # 55,653 B = 87%
    "data/site/swings.json": (100_000, 12_000),
    "data/site/comebacks.json": (40_000, 0),            # ranked top 50: no per-season growth
    "data/site/outcomes.json": (10_000, 0),             # frozen closed-season cells
    "data/site/gorates.json": (5_000, 0),
    "data/site/calib.json": (3_000, 0),
    "data/site/era.json": (3_000, 300),                 # one row per season
    "data/site/fg_rates.json": (6_000, 700),            # one key per season
    "data/site/goalline.json": (10_000, 1_500),
    "frontend/lib/teamGarbageTime.json": (60_000, 8_000),
    "frontend/lib/qbIndex.json": (30_000, 4_000),
    "frontend/public/data/players/*.json": (30_000, 4_000),
    "data/site/charts/*.json": (165_000, 0),            # 136,085 B max = 91% of the old 150,000
    "data/site/drives/*.json": (200_000, 0),            # 172,570 B max = 96% of the old 180,000
}


def size_cap(rel: str) -> int:
    """Byte cap for a lane output (repo-relative path or the SIZE_CAPS glob key)."""
    if rel not in SIZE_CAPS:
        from fnmatch import fnmatch
        rel = next(k for k in SIZE_CAPS if fnmatch(rel, k))
    closed, per_open = SIZE_CAPS[rel]
    return closed + per_open * len(OPEN)
