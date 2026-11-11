"""Build data/site/goalline.json for C4 Goal-line stand badge (NFL Stories UI; badge only, no collection page).

Source: nflverse play-by-play, seasons in mining/seasons.py (closed 2019-2025) (REG+POST). A try is down == 4, yardline_100 == 1, play_type run or
pass; a stand (stop) is a try with nflverse touchdown == 0 (spec rule; verify_out.txt: 100 stops). The badge
finds its play by game_id + quarter + clock + offense, never by play id. ``rates`` are the popover numbers:
went-for-it share of all 4th-and-goal-at-the-1 snaps (run, pass, field goal; verify_out: 229 of 255), TD rate
overall and by run / pass. No play ids, EPA, win chance or betting fields.

Frozen (mining/_frozen.py): published stops and rates never change; new stops are appended only, never
into a closed season (<= 2025) or a watermarked week.

Usage: python mining/build_goalline.py PBP_PARQUET [...] [--out data/site/goalline.json]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _frozen import check_frozen as _check  # noqa: E402
from build_stamp import stamp  # noqa: E402

import _frozen as fz  # noqa: E402
from _frozen import read_pbp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/goalline.json"
SCHEMA = "goalline/v1"
COLS = ["season", "week", "season_type", "game_id", "offense", "defense", "qtr", "clock", "kind"]
COLUMNS = ["game_id", "season", "week", "season_type", "game_date", "posteam", "defteam", "down", "yardline_100",
           "play_type", "touchdown", "qtr", "time"]


def _rate(made: int, n: int) -> dict[str, Any]:
    return {"tries": n, "scored": made, "rate": round(made / n, 4) if n else None}


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    spots = [r for r in rows if r.get("down") == 4 and r.get("yardline_100") == 1
             and r.get("play_type") in ("run", "pass", "field_goal")]
    tries = [r for r in spots if r["play_type"] in ("run", "pass")]
    td = lambda r: r.get("touchdown") == 1  # noqa: E731
    stops = sorted(([int(r["season"]), int(r["week"]), r["season_type"], r["game_id"], r["posteam"], r["defteam"],
                     int(r["qtr"]), r["time"], r["play_type"]] for r in tries if not td(r)),
                   key=lambda s: (s[3], s[6], [-int(x) for x in s[7].split(":")]))
    kind = lambda k: [r for r in tries if r["play_type"] == k]  # noqa: E731
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG+POST",
        "builtAt": "",
        "dataThrough": max(str(r.get("game_date") or "")[:10] for r in rows),
        "season_list": sorted({int(r["season"]) for r in rows}),
        "rates": {"chances": len(spots), "went": len(tries), **_rate(sum(map(td, tries)), len(tries)),
                  "run": _rate(sum(map(td, kind("run"))), len(kind("run"))),
                  "pass": _rate(sum(map(td, kind("pass"))), len(kind("pass")))},
        "cols": COLS,
        "stops": stops,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    return _check(old, new, lambda r: (r["game_id"], r["qtr"], r["clock"], r["offense"]), "stops", ("rates",), name="goalline")


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = read_pbp(paths, COLUMNS)
    df["game_date"] = df["game_date"].astype(str)
    return json.loads(df.to_json(orient="records"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(load_rows(a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    bad = check_frozen(old, new)
    if bad:
        print("FAIL: published goal-line data would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(stamp(new, old), separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['stops'])} stops)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
