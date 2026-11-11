"""G1 First-down call: weekly 1st-and-10 "pass or run?" picks -> data/site/firstdown.json.

Source: nflverse play-by-play, seasons in mining/seasons.py (closed 2019-2025), regular season, quarters 1-4. A play qualifies when it is 1st & 10,
the score is within 8 points before the snap, it is a called pass or run (nflverse play_type; scrambles are
passes), and there is no penalty, kneel, spike or aborted snap. Outcomes use yards only (nflverse yards_gained):
"good" means 4 or more yards, or a first down / touchdown. No EPA, success, win chance, play ids or betting fields.
Picks are deterministic (sha1 of game_id|qtr|clock|offense), 5 per week for 104 weeks, so the build repeats.
"""
from __future__ import annotations

import argparse
import hashlib
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
OUT = ROOT / "data/site/firstdown.json"
SCHEMA = "firstdown/v1"
PER_WEEK, WEEKS = 5, 104
COLS = ["season", "week", "game_id", "offense", "defense", "qtr", "clock", "yardline_100", "off_score", "def_score",
        "call", "yards", "result"]
COLUMNS = ["game_id", "season", "week", "season_type", "game_date", "qtr", "time", "down", "ydstogo", "yardline_100",
           "penalty", "qb_kneel", "qb_spike", "aborted_play", "play_type", "yards_gained", "posteam", "defteam",
           "posteam_score", "defteam_score", "touchdown", "interception", "fumble_lost", "first_down",
           "incomplete_pass"]


def eligible(r: dict[str, Any]) -> bool:
    return (r.get("season_type") == "REG" and (r.get("qtr") or 9) <= 4 and r.get("down") == 1
            and r.get("ydstogo") == 10 and r.get("play_type") in ("pass", "run")
            and r.get("posteam_score") is not None and abs(r["posteam_score"] - r["defteam_score"]) <= 8
            and not any(r.get(k) == 1 for k in ("penalty", "qb_kneel", "qb_spike", "aborted_play"))
            and r.get("yards_gained") is not None)


def result(r: dict[str, Any]) -> str:
    if r.get("interception") == 1:
        return "INT"
    if r.get("fumble_lost") == 1:
        return "FUM"
    if r.get("touchdown") == 1:
        return "TD"
    if r.get("incomplete_pass") == 1:
        return "INC"
    return "1D" if r.get("first_down") == 1 else "GAIN"


def good(r: dict[str, Any]) -> bool:
    lost = r.get("interception") == 1 or r.get("fumble_lost") == 1
    return not lost and (r["yards_gained"] >= 4 or r.get("first_down") == 1 or r.get("touchdown") == 1)


def _stats(rs: list[dict[str, Any]]) -> dict[str, Any]:
    n = len(rs)
    return {"plays": n, "avg_yards": round(sum(r["yards_gained"] for r in rs) / n, 2) if n else None,
            "good": round(sum(good(r) for r in rs) / n, 4) if n else None}


def key(r: dict[str, Any]) -> str:
    return f'{r["game_id"]}|{r["qtr"]}|{r["time"]}|{r["posteam"]}'


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    plays = [r for r in rows if eligible(r)]
    seasons = {}
    for s in sorted({r["season"] for r in plays}):
        sr = [r for r in plays if r["season"] == s]
        p = [r for r in sr if r["play_type"] == "pass"]
        seasons[str(s)] = {"plays": len(sr), "pass_rate": round(len(p) / len(sr), 4),
                           "pass": _stats(p), "run": _stats([r for r in sr if r["play_type"] == "run"])}
    league = {c: _stats([r for r in plays if r["play_type"] == c]) for c in ("pass", "run")}
    pick = sorted(plays, key=lambda r: hashlib.sha1(key(r).encode()).hexdigest())[:PER_WEEK * WEEKS]
    out = [[r["season"], r["week"], r["game_id"], r["posteam"], r["defteam"], r["qtr"], r["time"],
            r["yardline_100"], int(r["posteam_score"]), int(r["defteam_score"]), r["play_type"],
            int(r["yards_gained"]), result(r)] for r in pick]
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG Q1-Q4, 1st & 10, score within 8, called pass or run",
        "builtAt": "",
        "dataThrough": max(str(r.get("game_date") or "")[:10] for r in plays),
        "good_rule": "4+ yards, a first down or a touchdown, without a turnover",
        "per_week": PER_WEEK,
        "eligible": len(plays),
        "league": league,
        "seasons": seasons,
        "cols": COLS,
        "plays": out,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    o = {**old, "plays": [dict(zip(old["cols"], p)) for p in old["plays"]]}
    n = {**new, "plays": [dict(zip(new["cols"], p)) for p in new["plays"]]}
    return _check(o, n, lambda r: (r["game_id"], r["qtr"], r["clock"], r["offense"]), "plays", ("league", "seasons"),
                  name="firstdown", ranked=True)


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
        print("FAIL: published first-down data would change: " + "; ".join(map(str, bad[:10])), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(stamp(new, old), separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {new['eligible']} eligible, {len(new['plays'])} picks)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
