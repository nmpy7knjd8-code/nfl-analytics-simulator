"""A4 kick bands: per-yard field-goal tries/makes from nflverse play-by-play, 2019-2025.

Filter: play_type == 'field_goal', kick_distance not null; made = field_goal_result == 'made'
(missed and blocked count as tries). REG + POST. Tries past 64 yards are dropped: the site's
kick range stops at 64. Writes frontend/lib/site/fg_rates.json:

    python backend/scripts/build_fg_rates.py --pbp-dir /path/to/pbp_parquets
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path

import pandas as pd

SEASONS = list(range(2019, 2026))
MIN_YD, MAX_YD = 18, 64
BANDS = [("under-30", 0, 29), ("30-39", 30, 39), ("40-49", 40, 49), ("50-54", 50, 54), ("55-59", 55, 59), ("60-64", 60, 64)]
OUT = Path(__file__).resolve().parents[2] / "frontend" / "lib" / "site" / "fg_rates.json"


def load(pbp_dir: Path) -> pd.DataFrame:
    cols = ["season", "play_type", "kick_distance", "field_goal_result"]
    d = pd.concat([pd.read_parquet(pbp_dir / f"pbp_{y}.parquet", columns=cols) for y in SEASONS])
    f = d[(d.play_type == "field_goal") & d.kick_distance.notna()].copy()
    f["yd"] = f.kick_distance.astype(int)
    f["made"] = (f.field_goal_result == "made").astype(int)
    return f


def per_yard(f: pd.DataFrame) -> list[list[int]]:
    g = f.groupby("yd").made.agg(["size", "sum"])
    return [[int(g["size"].get(y, 0)), int(g["sum"].get(y, 0))] for y in range(MIN_YD, MAX_YD + 1)]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pbp-dir", type=Path, required=True)
    f = load(ap.parse_args().pbp_dir)
    f = f[f.yd <= MAX_YD]
    assert f.yd.min() >= MIN_YD
    yards = {"all": per_yard(f), **{str(s): per_yard(f[f.season == s]) for s in SEASONS}}
    out = {
        "schema": "fg_rates/v2",
        "source": "nflverse play-by-play (CC BY 4.0), 2019-2025 REG+POST: play_type == 'field_goal'; made = field_goal_result == 'made'",
        "builtAt": dt.date.today().isoformat(),
        "seasons": SEASONS,
        "minYards": MIN_YD,
        "maxYards": MAX_YD,
        "fewKicksBelow": 30,
        "smoothYards": 2,
        "bands": [{"id": i, "min": a, "max": b} for i, a, b in BANDS],
        "yards": yards,
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
