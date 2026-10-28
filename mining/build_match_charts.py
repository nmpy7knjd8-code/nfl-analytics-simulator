"""Build data/site/charts/{season}.json (schema matchcharts/v1) for E3 "Match the chart".

Source: nflverse play-by-play 2019-2025, REG+POST, Vegas-adjusted win chance (vegas_home_wp; house rule,
values copied from nflverse and rounded to 3 dp, never recomputed).

Per game: 60 home win-chance points evenly spaced over the 3,600 s of regulation (t = i*3600/59, i = 0..59).
Point i is vegas_home_wp on the last regulation row (qtr 1-4, win chance not null, nflverse row order) at or
before regulation time t. Overtime rows are never used: an overtime game keeps its regulation chart plus
ot: true. Game 2022_17_BUF_CIN (not finished) is left out. Scores are nflverse finals.
No play ids, EPA or betting fields.

Frozen data: a game already in a committed season file must not change; the build exits 1 if it would.

Usage: python mining/build_match_charts.py PBP_PARQUET [...] [--out-dir data/site/charts]
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
OUT_DIR = ROOT / "data/site/charts"
SCHEMA = "matchcharts/v1"
POINTS = 60
REG_SECONDS = 3600
BAD_GAME = "2022_17_BUF_CIN"
COLUMNS = ["game_id", "season", "week", "season_type", "game_date", "home_team", "away_team", "home_score",
           "away_score", "qtr", "game_seconds_remaining", "vegas_home_wp", "play_id"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def sample_times() -> list[float]:
    return [i * REG_SECONDS / (POINTS - 1) for i in range(POINTS)]


def game_chart(rows: list[dict[str, Any]]) -> list[float] | None:
    """rows: one game's rows in nflverse order."""
    pts = []
    for r in rows:
        q, gsr, wp = _num(r.get("qtr")), _num(r.get("game_seconds_remaining")), _num(r.get("vegas_home_wp"))
        if q is None or not 1 <= q <= 4 or gsr is None or wp is None:
            continue
        pts.append((REG_SECONDS - gsr, wp))
    if not pts:
        return None
    out, j = [], 0
    for t in sample_times():
        while j + 1 < len(pts) and pts[j + 1][0] <= t:
            j += 1
        out.append(round(pts[j][1], 3))
    return out


def build(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    games: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        if r.get("game_id") != BAD_GAME:
            games.setdefault(r["game_id"], []).append(r)
    by_season: dict[int, list[dict[str, Any]]] = {}
    last: dict[int, str] = {}
    for gid, rs in games.items():
        rs.sort(key=lambda r: float(r.get("play_id") or 0))
        f = rs[0]
        s = int(f["season"])
        last[s] = max(last.get(s, ""), str(f.get("game_date") or ""))
        wp = game_chart(rs)
        if wp is None:
            continue
        by_season.setdefault(s, []).append({
            "gameId": gid, "week": int(f["week"]), "seasonType": f["season_type"],
            "home": f["home_team"], "away": f["away_team"],
            "homeScore": int(f["home_score"]), "awayScore": int(f["away_score"]),
            "ot": any(_num(r.get("qtr")) == 5 for r in rs), "wp": wp,
        })
    return {s: {"schema": SCHEMA, "season": s, "builtAt": "", "dataThrough": last[s][:10], "points": POINTS,
                "games": sorted(g, key=lambda x: (x["week"], x["gameId"]))} for s, g in sorted(by_season.items())}


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    by = {g["gameId"]: g for g in new["games"]}
    changed = [g["gameId"] for g in old.get("games", []) if by.get(g["gameId"]) != g]
    return changed + (["points"] if old.get("points") != new["points"] else [])


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
    olds = {}
    fails = []
    for s, new in built.items():
        p = out_dir / f"{s}.json"
        olds[s] = json.loads(p.read_text()) if p.exists() else None
        fails += [f"{s}:{g}" for g in check_frozen(olds[s], new)]
    if fails:
        print(f"FAIL: published chart games would change: {', '.join(fails)}", file=sys.stderr)
        return 1
    out_dir.mkdir(parents=True, exist_ok=True)
    for s, new in built.items():
        p = out_dir / f"{s}.json"
        p.write_text(dumps(stamp(new, olds[s])))
        print(f"wrote {p} ({p.stat().st_size} bytes, {len(new['games'])} games)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
