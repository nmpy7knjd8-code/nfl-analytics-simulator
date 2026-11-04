"""Build data/site/outcomes.json (schema outcomes/v1) for D5: yards gained on 4th-down runs and passes.

Source: nflverse play-by-play 2019-2025, REG+POST. Counts only; no win chance is shown, so overtime
rows are kept (qtr 1-5).

Filter (/workspace/nfl-research/charts/d5-data-shape.md):
  * down == 4, play_type in run, pass, yards_gained not null, yardline_100 not null;
  * ydstogo 1..10, where 10 means 10 or more;
  * one bin per yard from -5 to 20: -5 = "-5 or less", 20 = "20 or more".
converted = fourth_down_converted == 1; penaltyFirstDowns = first_down_penalty == 1.
Cells are keyed `${ydstogo}-${zoneId}`. No play ids, EPA or betting fields.

Frozen data: the build exits 1 if any published cell would change while the seasons stay the same.

Usage: python mining/build_outcomes.py PBP_PARQUET [...] [--out data/site/outcomes.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_stamp import stamp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/outcomes.json"
SCHEMA = "outcomes/v1"
MIN_TRIES = 30
BINS = list(range(-5, 21))
ZONES = [("opp", "Opponent's 40 and in", 1, 40), ("mid", "Midfield", 41, 60), ("own", "Own side", 61, 99),
         ("all", "Anywhere", 1, 99)]
COLUMNS = ["season", "game_date", "down", "ydstogo", "yardline_100", "play_type", "yards_gained",
           "fourth_down_converted", "first_down_penalty"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def keep(r: dict[str, Any]) -> bool:
    return (_num(r.get("down")) == 4 and r.get("play_type") in ("run", "pass")
            and _num(r.get("yards_gained")) is not None and _num(r.get("yardline_100")) is not None
            and (_num(r.get("ydstogo")) or 0) >= 1)


def bin_index(yards: float) -> int:
    return int(min(max(yards, BINS[0]), BINS[-1])) - BINS[0]


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    seasons = sorted({int(r["season"]) for r in rows})
    cells = {f"{d}-{z[0]}": {"tries": 0, "converted": 0, "penaltyFirstDowns": 0, "counts": [0] * len(BINS)}
             for d in range(1, 11) for z in ZONES}
    last = ""
    for r in rows:
        last = max(last, str(r.get("game_date") or ""))
        if not keep(r):
            continue
        dist, yl = min(int(r["ydstogo"]), 10), float(r["yardline_100"])
        for zid, _, lo, hi in ZONES:
            if lo <= yl <= hi:
                c = cells[f"{dist}-{zid}"]
                c["tries"] += 1
                c["converted"] += int(_num(r.get("fourth_down_converted")) == 1)
                c["penaltyFirstDowns"] += int(_num(r.get("first_down_penalty")) == 1)
                c["counts"][bin_index(float(r["yards_gained"]))] += 1
    span = f"{seasons[0]}-{seasons[-1]}" if seasons else ""
    return {
        "schema": SCHEMA,
        "source": f"nflverse play-by-play {span} (CC BY 4.0), REG+POST incl. overtime: yards gained on 4th-down "
                  "runs and passes",
        "builtAt": "",
        "dataThrough": last[:10],
        "seasons": [seasons[0], seasons[-1]] if seasons else [],
        "minTries": MIN_TRIES,
        "bins": BINS,
        "zones": [{"id": z, "label": l, "min": lo, "max": hi} for z, l, lo, hi in ZONES],
        "cells": cells,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"] or old.get("seasons") != new["seasons"]:
        return []
    changed = [k for k, v in old.get("cells", {}).items() if new["cells"].get(k) != v]
    return changed + [k for k in ("bins", "zones") if old.get(k) != new[k]]


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    last = df.game_date.astype(str).max()
    df = df[df.down == 4].copy()
    df["game_date"] = df["game_date"].astype(str)
    rows = json.loads(df.to_json(orient="records"))
    rows.append({"season": int(df.season.max()), "game_date": last})
    return rows


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(load_rows(a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    changed = check_frozen(old, new)
    if changed:
        print(f"FAIL: published outcome cells would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    new = stamp(new, old)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
