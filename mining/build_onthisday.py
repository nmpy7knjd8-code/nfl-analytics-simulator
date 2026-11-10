"""Build data/site/onthisday.json for G4 On This Day (NFL Stories UI home card).

Source: nflverse play-by-play 2019-2025 (REG+POST) final scores; game_date is nflverse's (US Eastern) date.
2022_17_BUF_CIN (suspended, no final) is left out. ``days`` maps each MM-DD that had games (any season)
to its games [game_id, year, away_score, home_score, ot] (ot = true when the game had any nflverse play with
qtr >= 5, i.e. went to overtime); ``fallback`` maps every other MM-DD of the 366 (Feb 29
included) to the offset in days of the nearest day that had games (circular across New Year; ties go to the
earlier day; negative = earlier, e.g. -2 = "two days ago"). The FE picks the key in
New York time. No play ids, EPA, win chance or betting fields.

Frozen: a published game row may not change; a day may only gain games appended after its published ones, from
an open season past the watermark (mining/_frozen.py); fallback is frozen. The one allowed
change is the append-only ``ot`` column (mining/frozen_overrides/onthisday-2026-11-04-ot-append.json): cols must
be exactly the old 4 + ["ot"] and the first 4 values of every row must stay identical.

Usage: python mining/build_onthisday.py PBP_PARQUET [...] [--out data/site/onthisday.json]
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_stamp import stamp  # noqa: E402

import _frozen as fz  # noqa: E402
from _frozen import read_pbp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/onthisday.json"
SCHEMA = "onthisday/v1"
NO_RESULT_GAME = "2022_17_BUF_CIN"
COLS = ["game_id", "year", "away_score", "home_score", "ot"]  # game_id = season_week_AWAY_HOME
COLUMNS = ["game_id", "season", "week", "season_type", "game_date", "home_team", "away_team", "home_score",
           "away_score", "qtr"]
OT_OVERRIDE = ROOT / "mining/frozen_overrides/onthisday-2026-11-04-ot-append.json"
LEAP = 2024


def all_keys() -> list[str]:
    d0 = date(LEAP, 1, 1)
    return [(d0 + timedelta(i)).strftime("%m-%d") for i in range(366)]


def nearest(key: str, have: set[str]) -> tuple[int, str]:
    d = date.fromisoformat(f"{LEAP}-{key}")
    for k in range(0, 184):
        for off in (-k, k):  # earlier first on ties
            m = (d + timedelta(off)).strftime("%m-%d")
            if m in have:
                return off, m
    raise ValueError("no games")


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    games: dict[str, dict[str, Any]] = {}
    for r in rows:
        if r["game_id"] != NO_RESULT_GAME:
            games.setdefault(r["game_id"], r)
    gl = sorted(games.values(), key=lambda r: (str(r["game_date"])[:10], r["game_id"]))
    by_md: dict[str, list[list[Any]]] = {}
    for g in gl:
        d = str(g["game_date"])[:10]
        by_md.setdefault(d[5:], []).append([g["game_id"], int(d[:4]), int(g["away_score"]), int(g["home_score"]),
                                       bool(g.get("ot", False))])
    fallback = {}
    for k in all_keys():
        if k not in by_md:
            off, _ = nearest(k, set(by_md))
            fallback[k] = off
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG+POST final scores; dates are US Eastern",
        "builtAt": "",
        "dataThrough": str(gl[-1]["game_date"])[:10],
        "season_list": sorted({int(g["season"]) for g in gl}),
        "cols": COLS,
        "days": dict(sorted(by_md.items())),
        "fallback": fallback,
    }


def ot_append_ok(old: dict[str, Any], new: dict[str, Any]) -> bool:
    if old.get("cols") != COLS[:4] or new.get("cols") != COLS or not OT_OVERRIDE.exists():
        return False
    o = json.loads(OT_OVERRIDE.read_text())
    return o.get("rule") == "ot_append" and bool(o.get("approved_by"))


def strip_ot(d: dict[str, Any]) -> dict[str, Any]:
    return {**d, "cols": d["cols"][:4], "days": {k: [g[:4] for g in gs] for k, gs in d["days"].items()}}


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    if old.get("cols") != new.get("cols"):
        if not ot_append_ok(old, new):
            return ["cols"]
        new = strip_ot(new)
    newg = {g[0]: g for gs in new["days"].values() for g in gs}
    bad = [g[0] for gs in old["days"].values() for g in gs if newg.get(g[0]) != g]
    for d, gs in new["days"].items():  # per day: append-only, never into a frozen season/week
        bad += [f"{d}:{r}" for r in fz.check_rows(old["days"].get(d, []), gs, lambda g: g[0], "onthisday",
                                                   gid=lambda g: g[0])]
    bad += [f"days:{d} removed" for d in old["days"] if d not in new["days"]]
    bad += ["fallback"] if old["fallback"] != new["fallback"] else []
    return bad


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = read_pbp(paths, COLUMNS)
    ot = df.groupby("game_id")["qtr"].max().ge(5)
    df = df.drop_duplicates("game_id").drop(columns="qtr")
    df["ot"] = df["game_id"].map(ot).astype(bool)
    df["game_date"] = df["game_date"].astype(str)
    return json.loads(df.to_json(orient="records"))


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
    bad = check_frozen(old, new)
    if bad:
        print("FAIL: published on-this-day data would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(stamp(new, old)))
    print(f"wrote {out} ({out.stat().st_size} bytes, {sum(map(len, new['days'].values()))} games)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
