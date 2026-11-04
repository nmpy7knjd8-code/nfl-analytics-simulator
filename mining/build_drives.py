"""Build data/site/drives/{season}.json for F7 drive strips (play-feed drive headers, NFL Charts UI).

Source: nflverse play-by-play 2019-2025 (REG+POST). One entry per nflverse drive (fixed_drive) that has at
least one snap, in game order. Each drive: offense, start quarter and clock (nflverse drive_quarter_start /
drive_game_clock_start), net yards (nflverse ydsnet), result (nflverse fixed_drive_result) and one tile per
snap (run, pass, punt, field goal, kneel, spike; nflverse row order) shaded by the play's own outcome, never
by a model value:
  T touchdown, F first down, G gain, N no gain or loss, X turnover (interception / lost fumble),
  K kick (punt or field goal try), Q kneel or spike.
Each drive is one string "TEAM QTR CLOCK YARDS RESULT TILES" (e.g. "NO 1 13:02 83 DN FFGGFNGFFNNGG") to keep
the file small; plays = number of tiles; result codes are spelled out in ``result_key``. Overtime drives are included (no win chance anywhere in this file). The bad
2019_03_CIN_BUF "End of half" row and the row before it are dropped; 2022_17_BUF_CIN is left out.
No play ids, EPA or betting fields.

Frozen: a published game's drives may not change.

Usage: python mining/build_drives.py PBP_PARQUET [...] [--out-dir data/site/drives]
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
OUT_DIR = ROOT / "data/site/drives"
SCHEMA = "drives/v1"
NO_RESULT_GAME = "2022_17_BUF_CIN"
BAD_ROW_GAME = "2019_03_CIN_BUF"
SNAPS = {"run", "pass", "punt", "field_goal", "qb_kneel", "qb_spike"}
RESULTS = {"Touchdown": "TD", "Field goal": "FG", "Punt": "P", "Turnover": "TO", "Turnover on downs": "DN",
           "Missed field goal": "MF", "End of half": "EH", "Opp touchdown": "OT", "Safety": "SF"}
RESULT_KEY = {"TD": "Touchdown", "FG": "Field goal", "P": "Punt", "TO": "Turnover", "DN": "Turnover on downs",
              "MF": "Missed field goal", "EH": "End of half", "OT": "Opponent touchdown", "SF": "Safety"}
COLS = ["team", "qtr", "clock", "yards", "result", "tiles"]  # one space-separated string per drive
COLUMNS = ["game_id", "season", "week", "season_type", "game_date", "home_team", "away_team", "fixed_drive",
           "fixed_drive_result", "posteam", "play_type", "drive_quarter_start", "drive_game_clock_start",
           "ydsnet", "yards_gained", "first_down", "touchdown", "td_team", "interception", "fumble_lost", "desc"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def tile(r: dict[str, Any]) -> str:
    pt = r["play_type"]
    if _num(r.get("interception")) == 1 or _num(r.get("fumble_lost")) == 1:
        return "X"
    if _num(r.get("touchdown")) == 1 and r.get("td_team") == r.get("posteam"):
        return "T"
    if pt in ("punt", "field_goal"):
        return "K"
    if pt in ("qb_kneel", "qb_spike"):
        return "Q"
    if _num(r.get("first_down")) == 1:
        return "F"
    return "G" if (_num(r.get("yards_gained")) or 0) > 0 else "N"


def game_drives(rs: list[dict[str, Any]]) -> list[str]:
    bad = set()
    for i, r in enumerate(rs):
        if r["game_id"] == BAD_ROW_GAME and str(r.get("desc") or "").startswith("End of half"):
            bad |= {i, i - 1}
    drives: dict[int, list[dict[str, Any]]] = {}
    for i, r in enumerate(rs):
        d = _num(r.get("fixed_drive"))
        if i in bad or d is None or r.get("play_type") not in SNAPS or not r.get("posteam"):
            continue
        drives.setdefault(int(d), []).append(r)
    out = []
    for d in sorted(drives):
        snaps = drives[d]
        f = snaps[0]
        y = _num(f.get("ydsnet"))
        q = int(_num(f.get("drive_quarter_start")) or _num(f.get("qtr")) or 0)
        res = RESULTS[f["fixed_drive_result"]]
        out.append(" ".join([f["posteam"], str(q), str(f.get("drive_game_clock_start") or "-"),
                             "-" if y is None else str(int(y)), res, "".join(tile(r) for r in snaps)]))
    return out


def build(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    games: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        if r["game_id"] != NO_RESULT_GAME:
            games.setdefault(r["game_id"], []).append(r)
    by_season: dict[int, dict[str, Any]] = {}
    last: dict[int, str] = {}
    for gid, rs in sorted(games.items()):
        s = int(rs[0]["season"])
        last[s] = max(last.get(s, ""), str(rs[0].get("game_date") or "")[:10])
        by_season.setdefault(s, {})[gid] = game_drives(rs)
    return {s: {"schema": SCHEMA, "season": s, "builtAt": "", "dataThrough": last[s],
                "tile_key": {"T": "touchdown", "F": "first down", "G": "gain", "N": "no gain or loss",
                             "X": "turnover", "K": "kick", "Q": "kneel or spike"},
                "result_key": RESULT_KEY, "cols": COLS, "games": g} for s, g in sorted(by_season.items())}


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    return [g for g, v in old["games"].items() if new["games"].get(g) != v] + (
        ["cols"] if old["cols"] != new["cols"] else [])


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df["game_date"] = df["game_date"].astype(str)
    return json.loads(df.to_json(orient="records"))


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    a = ap.parse_args(argv)
    out_dir = Path(a.out_dir)
    built = build(load_rows(a.pbp))
    olds, fails = {}, []
    for s, new in built.items():
        p = out_dir / f"{s}.json"
        olds[s] = json.loads(p.read_text()) if p.exists() else None
        fails += [f"{s}:{g}" for g in check_frozen(olds[s], new)]
    if fails:
        print("FAIL: published drives would change: " + ", ".join(fails[:10]), file=sys.stderr)
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)
    for s, new in built.items():
        p = out_dir / f"{s}.json"
        p.write_text(dumps(stamp(new, olds[s])))
        print(f"wrote {p} ({p.stat().st_size} bytes, {len(new['games'])} games)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
