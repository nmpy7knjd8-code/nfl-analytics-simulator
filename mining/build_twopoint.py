"""Build data/site/twopoint.json for B1 concept 1 ("Kick or go for two?" card, NFL Product UI).

Source: nflverse play-by-play 2019-2025 (REG + POST). Shown values are real nflverse rates only
(concept 1: no engine values):
  * two-point tries: two_point_attempt == 1 -> 960 tries, 456 success (47.5%); run 266, pass 681,
    13 "no_play" rows that still carry a result (counted in the overall rate only);
  * extra points: play_type == "extra_point", extra_point_result == "good" -> 9,119 tries.
Per-try rows ("situations") are regulation only (qtr 5 dropped: 3 tries) and carry nflverse vegas_wp at
the try (4 dp). Per-choice win chance (go for 2 vs kick) needs an engine/model from NFL Data & Models;
none exists on main, so it is NOT included (no invented values).
No EPA, xpass, play ids or betting fields. Rows are arrays under "cols" to keep the file small.

Frozen: every published try must stay identical; rates may change only when a season is added.

Usage: python mining/build_twopoint.py PBP_PARQUET [...] [--out data/site/twopoint.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _frozen import check_frozen as _check  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/twopoint.json"
COLUMNS = ["game_id", "season", "week", "season_type", "posteam", "defteam", "qtr", "time", "play_type",
           "two_point_attempt", "two_point_conv_result", "extra_point_result", "score_differential", "vegas_wp"]
COLS = ["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made", "wp"]
SUMMARY = ("two_point", "extra_point")


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _rate(made: int, tries: int) -> dict[str, Any]:
    return {"tries": tries, "made": made, "rate": round(made / tries, 4) if tries else 0.0}


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tries = [r for r in rows if _num(r.get("two_point_attempt")) == 1]
    xps = [r for r in rows if r.get("play_type") == "extra_point"]
    ok = lambda r: r.get("two_point_conv_result") == "success"  # noqa: E731
    by = lambda k: [r for r in tries if r.get("play_type") == k]  # noqa: E731
    situ = []
    for r in tries:
        if int(r["qtr"]) > 4:
            continue  # no overtime situations / win chance
        situ.append([int(r["season"]), int(r["week"]), r["season_type"], r["game_id"], r["posteam"], r["defteam"],
                     int(r["qtr"]), r["time"], int(r["score_differential"]), r["play_type"], int(ok(r)),
                     round(_num(r["vegas_wp"]), 4) if _num(r.get("vegas_wp")) is not None else None])
    situ.sort(key=lambda s: (s[0], s[1], s[3], s[6], [-int(x) for x in s[7].split(":")]))
    return {
        "schema_version": 1,
        "source": "nflverse play-by-play via mining/build_twopoint.py",
        "season_list": sorted({int(r["season"]) for r in rows}),
        "win_chance": "nflverse win chance (adjusted for pregame expectations) for the scoring team at the try; "
                      "regulation only",
        "two_point": {**_rate(sum(map(ok, tries)), len(tries)),
                      "run": _rate(sum(map(ok, by("run"))), len(by("run"))),
                      "pass": _rate(sum(map(ok, by("pass"))), len(by("pass")))},
        "extra_point": _rate(sum(r.get("extra_point_result") == "good" for r in xps), len(xps)),
        "per_choice_win_chance": None,
        "cols": COLS,
        "tries": situ,
    }


def key(r: dict[str, Any]) -> tuple:
    return (r["game_id"], r["qtr"], r["clock"], r["team"])


def check_frozen(old, new):
    return _check(old, new, key, "tries", SUMMARY)


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd
    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df = df[(df["two_point_attempt"] == 1) | (df["play_type"] == "extra_point")]
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
        print("FAIL: published two-point data would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(new, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['tries'])} tries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
