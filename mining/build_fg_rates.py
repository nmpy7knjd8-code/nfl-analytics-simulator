"""Build data/site/fg_rates.json (schema fg_rates/v2) for A4 Kick bands.

Source: nflverse play-by-play 2019-2025. Counts only; nothing is modelled.

Filter (matches the shape agreed with NFL Charts UI, /workspace/nfl-research/charts/a4-data-shape.md):
  * play_type == "field_goal" with a kick_distance (every nflverse field_goal_attempt row);
  * regular season + playoffs, every quarter (a kick is a kick; no win chance is involved);
  * tries = made + missed + blocked (blocked kicks count as tries, like the NFL's FG%);
  * made = field_goal_result == "made";
  * kicks over 64 yards are left out entirely (house FG cap; the file never implies 65+).
Per-yard [tries, made] rows for MIN_FG..MAX_FG (18..64 = 47 rows) under "yards": "all" = every
season in the input, plus one key per season. Bands are inclusive; the UI sums them from the yards.
This is the single builder for A4 (it replaces backend/scripts/build_fg_rates.py from #159).
No betting fields, EPA or play ids.

Frozen data: a "yards" season key already in the committed file must not change (published numbers stay
put); the build exits 1 if it would. New seasons only add keys (and update "all").

Usage: python mining/build_fg_rates.py PBP_PARQUET [...] [--out data/site/fg_rates.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/fg_rates.json"
SCHEMA = "fg_rates/v2"
MIN_FG = 18
MAX_FG = 64
SMOOTH_YARDS = 2
FEW_KICKS_BELOW = 30
BANDS = [("under-30", 0, 29), ("30-39", 30, 39), ("40-49", 40, 49), ("50-54", 50, 54), ("55-59", 55, 59),
         ("60-64", 60, 64)]
COLUMNS = ["season", "game_date", "play_type", "kick_distance", "field_goal_result"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def band_index(yards: float) -> int | None:
    for i, (_, lo, hi) in enumerate(BANDS):
        if lo <= yards <= hi:
            return i
    return None


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    seasons = sorted({int(r["season"]) for r in rows})
    rates = {k: [[0, 0] for _ in range(MIN_FG, MAX_FG + 1)] for k in ["all", *map(str, seasons)]}
    last = ""
    for r in rows:
        last = max(last, str(r.get("game_date") or ""))
        d = _num(r.get("kick_distance"))
        if r.get("play_type") != "field_goal" or d is None or d > MAX_FG:
            continue
        if d < MIN_FG:
            raise ValueError(f"field goal shorter than {MIN_FG} yd in nflverse data: {d}")
        i = int(d) - MIN_FG
        made = int(r.get("field_goal_result") == "made")
        for k in ("all", str(int(r["season"]))):
            rates[k][i][0] += 1
            rates[k][i][1] += made
    span = f"{seasons[0]}-{seasons[-1]}" if seasons else ""
    return {
        "schema": SCHEMA,
        "source": f"nflverse play-by-play {span} (CC BY 4.0): field goal tries (made, missed, blocked), "
                  "regular season + playoffs, kicks over 64 yd left out",
        "builtAt": "",
        "dataThrough": last[:10],
        "seasons": seasons,
        "minYards": MIN_FG,
        "maxYards": MAX_FG,
        "fewKicksBelow": FEW_KICKS_BELOW,
        "smoothYards": SMOOTH_YARDS,
        "bands": [{"id": i, "min": lo, "max": hi} for i, lo, hi in BANDS],
        "yards": rates,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    """Season keys already published must be identical; "all" may only change when a season is added."""
    if not old:
        return []
    if old.get("schema") != new["schema"]:
        return []  # schema bump (v1 -> v2) replaces the file; values are re-checked by tests
    olds = set(old.get("yards", {})) - {"all"}
    news = set(new["yards"]) - {"all"}
    changed = [k for k in sorted(olds) if new["yards"].get(k) != old["yards"][k]]
    if olds == news and old["yards"].get("all") != new["yards"]["all"]:
        changed.append("all")
    for k in ("bands", "minYards", "maxYards"):
        if old.get(k) != new[k]:
            changed.append(k)
    return changed


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df = df[df.play_type == "field_goal"].copy()
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
        print(f"FAIL: published fg rates would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    new = stamp(new, old)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes, seasons {sorted(k for k in new['yards'] if k != 'all')})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
