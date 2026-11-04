"""Build data/site/gorates.json (schema gorates/v1) for D6: coaches' real 4th-down go-rates.

Source: nflverse play-by-play 2019-2025, REG+POST. Counts only; no engine layer (that waits for H6).

Filter (/workspace/nfl-research/charts/d6-data-shape.md):
  * down == 4, play_type in run, pass, punt, field_goal, yardline_100 not null;
  * regulation only (qtr 1-4);
  * field goal tries over 64 yards are left out (house FG cap; 6 in regulation 2019-2025).
cells[distance-1][band] = [plays, went, fieldGoals, punts]; distance = ydstogo 1..10 (10 = 10 or more),
band = yardline_100 in 10-yard bands 1-10 ... 91-99. went = run or pass.

Frozen data: the build exits 1 if any published cell would change while the seasons stay the same.

Usage: python mining/build_gorates.py PBP_PARQUET [...] [--out data/site/gorates.json]
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
OUT = ROOT / "data/site/gorates.json"
SCHEMA = "gorates/v1"
MAX_FG = 64
MIN_PLAYS = 10
DISTANCES = list(range(1, 11))
BANDS = [(lo, min(lo + 9, 99)) for lo in range(1, 100, 10)]
COLUMNS = ["season", "game_date", "qtr", "down", "ydstogo", "yardline_100", "play_type", "kick_distance"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def keep(r: dict[str, Any]) -> bool:
    qtr = _num(r.get("qtr"))
    if _num(r.get("down")) != 4 or qtr is None or not 1 <= qtr <= 4:
        return False
    if r.get("play_type") not in ("run", "pass", "punt", "field_goal") or _num(r.get("yardline_100")) is None:
        return False
    if (_num(r.get("ydstogo")) or 0) < 1:
        return False
    return not (r["play_type"] == "field_goal" and (_num(r.get("kick_distance")) or 0) > MAX_FG)


def band_index(yl: float) -> int:
    return min(int((yl - 1) // 10), len(BANDS) - 1)


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    seasons = sorted({int(r["season"]) for r in rows})
    cells = [[[0, 0, 0, 0] for _ in BANDS] for _ in DISTANCES]
    last = ""
    for r in rows:
        last = max(last, str(r.get("game_date") or ""))
        if not keep(r):
            continue
        c = cells[min(int(r["ydstogo"]), 10) - 1][band_index(float(r["yardline_100"]))]
        pt = r["play_type"]
        c[0] += 1
        c[1] += int(pt in ("run", "pass"))
        c[2] += int(pt == "field_goal")
        c[3] += int(pt == "punt")
    span = f"{seasons[0]}-{seasons[-1]}" if seasons else ""
    return {
        "schema": SCHEMA,
        "source": f"nflverse play-by-play {span} (CC BY 4.0), REG+POST, regulation only: 4th downs that ran a run, "
                  "pass, punt or field goal (field goals over 64 yd left out); went for it = run or pass",
        "builtAt": "",
        "dataThrough": last[:10],
        "seasons": [seasons[0], seasons[-1]] if seasons else [],
        "minPlays": MIN_PLAYS,
        "maxFgYards": MAX_FG,
        "distances": DISTANCES,
        "bands": [{"min": lo, "max": hi} for lo, hi in BANDS],
        "cells": cells,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"] or old.get("seasons") != new["seasons"]:
        return []
    changed = [f"{d}-{b}" for d, row in enumerate(old.get("cells", []), 1) for b, c in enumerate(row)
               if new["cells"][d - 1][b] != c]
    return changed + [k for k in ("distances", "bands") if old.get(k) != new[k]]


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
        print(f"FAIL: published go-rate cells would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    new = stamp(new, old)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
