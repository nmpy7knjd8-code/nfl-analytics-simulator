"""Build data/site/calib.json (schema calib/v1) for D2 "Is 5% really 5%?".

Checks nflverse's Vegas-adjusted win chance (vegas_home_wp, the house win chance) against what happened.
Values are nflverse's own; nothing is modelled here. model = "nflverse" ("ours" waits for H6).

Filter (/workspace/nfl-research/charts/d2-data-shape.md, with the house Vegas rule):
  * regulation only (qtr 1-4): overtime rows carry no win chance;
  * vegas_home_wp not null; game 2022_17_BUF_CIN (not finished) and tied games (result == 0) left out;
  * field goal tries over 64 yards left out (house FG cap).
Buckets [lo, hi) in percent of vegas_home_wp (the last bucket includes 100): 0-5, 5-10, 10-20 ... 90-95, 95-100.
predicted = mean vegas_home_wp x100 (1 dp); actual = share of rows where the home team won x100 (1 dp).

Frozen data: for the same season span, published buckets must not change; the build exits 1 if they would.

Usage: python mining/build_calib.py PBP_PARQUET [...] [--out data/site/calib.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/calib.json"
SCHEMA = "calib/v1"
MAX_FG = 64
BAD_GAME = "2022_17_BUF_CIN"
EDGES = [0, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100]
COLUMNS = ["game_id", "season", "game_date", "qtr", "play_type", "kick_distance", "vegas_home_wp", "result"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def keep(r: dict[str, Any]) -> bool:
    qtr, wp, res = _num(r.get("qtr")), _num(r.get("vegas_home_wp")), _num(r.get("result"))
    if qtr is None or not 1 <= qtr <= 4 or wp is None or res is None or res == 0 or r.get("game_id") == BAD_GAME:
        return False
    return not (r.get("play_type") == "field_goal" and (_num(r.get("kick_distance")) or 0) > MAX_FG)


def bucket(pct: float) -> int:
    for i in range(len(EDGES) - 1):
        if EDGES[i] <= pct < EDGES[i + 1]:
            return i
    return len(EDGES) - 2  # exactly 100


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    seasons = sorted({int(r["season"]) for r in rows})
    n = [0] * (len(EDGES) - 1)
    wp_sum = [0.0] * len(n)
    won = [0] * len(n)
    last = ""
    for r in rows:
        last = max(last, str(r.get("game_date") or ""))
        if not keep(r):
            continue
        wp = float(r["vegas_home_wp"])
        i = bucket(100 * wp)
        n[i] += 1
        wp_sum[i] += wp
        won[i] += int(float(r["result"]) > 0)
    span = f"{seasons[0]}-{seasons[-1]}" if seasons else ""
    return {
        "schema": SCHEMA,
        "model": "nflverse",
        "source": f"nflverse play-by-play {span} (CC BY 4.0), REG+POST: nflverse win chance adjusted for pregame "
                  "expectations (home team), regulation only; ties and 2022_17_BUF_CIN left out",
        "builtAt": "",
        "dataThrough": last[:10],
        "buckets": [{"lo": EDGES[i], "hi": EDGES[i + 1], "plays": n[i],
                     "predicted": round(100 * wp_sum[i] / n[i], 1) if n[i] else None,
                     "actual": round(100 * won[i] / n[i], 1) if n[i] else None} for i in range(len(n))],
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"] or old.get("source") != new["source"]:
        return []  # a new season span (or schema) replaces the buckets
    return [f"{b['lo']}-{b['hi']}" for b, nb in zip(old["buckets"], new["buckets"]) if b != nb] + (
        ["buckets"] if len(old["buckets"]) != len(new["buckets"]) else [])


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df["game_date"] = df["game_date"].astype(str)
    return json.loads(df.to_json(orient="records"))


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_stamp import stamp  # noqa: E402


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
        print(f"FAIL: published calibration buckets would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    new = stamp(new, old)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes, {sum(b['plays'] for b in new['buckets'])} plays)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
