"""Build data/site/era.json (schema era/v1) for F4 Era chart: 4th-down go-for-it rate by season x field zone.

Source: nflverse play-by-play 2019-2025 (REG + POST). Counts only; no win chance involved.

Filter (shape agreed with NFL Charts UI, /workspace/nfl-research/charts/f4-data-shape.md):
  * down == 4, play_type in run, pass, punt, field_goal, yardline_100 not null;
  * went = run or pass (fakes count as went, as nflverse labels them);
  * field goal tries over 64 yards are left out (house FG cap; 6 rows 2019-2025);
  * zones by yardline_100, inclusive: opp 1-40, mid 41-60, own 61-99.
Each season row is [plays, went] per zone plus "all". No betting fields, EPA or play ids.

Frozen data: a season row already in the committed file must not change; the build exits 1 if it would.

Usage: python mining/build_era.py PBP_PARQUET [...] [--out data/site/era.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/era.json"
SCHEMA = "era/v1"
MAX_FG = 64
PLAY_TYPES = frozenset({"run", "pass", "punt", "field_goal"})
ZONES = [("opp", "Opponent's 40 and in", "Opp 40 & in", 1, 40),
         ("mid", "Midfield (own 40 to opp 41)", "Midfield", 41, 60),
         ("own", "Own side (inside own 40)", "Own side", 61, 99)]
COLUMNS = ["season", "game_date", "down", "play_type", "yardline_100", "kick_distance"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def zone_id(yl: float) -> str | None:
    for zid, _, _, lo, hi in ZONES:
        if lo <= yl <= hi:
            return zid
    return None


def is_fourth_down_decision(r: dict[str, Any]) -> bool:
    if _num(r.get("down")) != 4 or r.get("play_type") not in PLAY_TYPES or _num(r.get("yardline_100")) is None:
        return False
    return not (r["play_type"] == "field_goal" and (_num(r.get("kick_distance")) or 0) > MAX_FG)


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    seasons = sorted({int(r["season"]) for r in rows})
    counts = {s: {k: [0, 0] for k in ("opp", "mid", "own", "all")} for s in seasons}
    last = ""
    for r in rows:
        last = max(last, str(r.get("game_date") or ""))
        if not is_fourth_down_decision(r):
            continue
        z = zone_id(float(r["yardline_100"]))
        if z is None:
            raise ValueError(f"yardline_100 outside 1-99: {r['yardline_100']}")
        went = int(r["play_type"] in ("run", "pass"))
        for k in (z, "all"):
            counts[int(r["season"])][k][0] += 1
            counts[int(r["season"])][k][1] += went
    span = f"{seasons[0]}-{seasons[-1]}" if seasons else ""
    return {
        "schema": SCHEMA,
        "source": f"nflverse play-by-play {span} (CC BY 4.0), REG+POST: 4th downs that ran a run, pass, punt or "
                  "field goal (field goals over 64 yd left out); went for it = run or pass",
        "builtAt": last[:10],
        "zones": [{"id": z, "label": l, "short": s, "min": lo, "max": hi} for z, l, s, lo, hi in ZONES],
        "seasons": [{"season": s, **counts[s]} for s in seasons],
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    by = {r["season"]: r for r in new["seasons"]}
    changed = [str(r["season"]) for r in old.get("seasons", []) if by.get(r["season"]) != r]
    if old.get("zones") != new["zones"]:
        changed.append("zones")
    return changed


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    last = df.game_date.astype(str).max()
    df = df[df.down == 4].copy()
    df["game_date"] = df["game_date"].astype(str)
    rows = json.loads(df.to_json(orient="records"))
    rows.append({"season": int(df.season.max()), "game_date": last})  # keeps builtAt = last game date
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
        print(f"FAIL: published era numbers would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['seasons'])} seasons)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
