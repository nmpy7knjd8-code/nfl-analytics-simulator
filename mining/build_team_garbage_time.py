"""Build frontend/lib/teamGarbageTime.json for F3 (garbage-time toggle, NFL Teams & Games UI).

Spec: nfl-research/teams/f3-garbage-time-json-shape.md (schema_version 1).

Two views of the same nflverse regular-season team stats:
  * "all":   every play (the red-zone numbers equal frontend/lib/teamRedzone.json exactly; the
             red-zone trip test is imported from mining/build_team_redzone.py);
  * "close": only snaps in regulation where nflverse vegas_wp (offense's Vegas-adjusted win chance
             at the snap) is between 0.10 and 0.90 inclusive. Overtime snaps are never "close"
             (house rule: no win chance in OT). A red-zone trip is "close" when its FIRST red-zone
             snap is close.
Stats per team (offense): rz = [trips, td, rank]  (rank by TD rate);
                          ypp = [plays, yards, rank]  (run+pass plays, nflverse yards_gained);
                          third = [att, conv, rank]  (3rd-down run+pass, nflverse third_down_converted).
Ranks are computed inside each view (and each season); ties share the better rank.
vegas_wp is read only to classify snaps; no EPA, xpass, play ids, win chances or betting fields are written.

Frozen data: every published season (both views), and the all-seasons block when the season list is
unchanged, must stay identical; an nflverse regrade fails the build (exit 1).

Usage: python mining/build_team_garbage_time.py PBP_PARQUET [...] [--out frontend/lib/teamGarbageTime.json]
"""
from __future__ import annotations

import argparse
import datetime as dt
import importlib.util
import json
import subprocess
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any, Callable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend/lib/teamGarbageTime.json"
SCHEMA_VERSION = 1
LO, HI = 0.10, 0.90
CLOSE_DEF = "Regulation snap with the offense's Vegas-adjusted win chance (nflverse vegas_wp) from 10% to 90%; red-zone trips use their first red-zone snap"
COLUMNS = ["game_id", "season", "season_type", "posteam", "fixed_drive", "fixed_drive_result",
           "yardline_100", "play_type", "qtr", "vegas_wp", "down", "yards_gained", "third_down_converted"]

_spec = importlib.util.spec_from_file_location("build_team_redzone", ROOT / "mining/build_team_redzone.py")
rz = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rz)
TEAMS, _num, FrozenChanged = rz.TEAMS, rz._num, rz.FrozenChanged
STATS = ("rz", "ypp", "third")


def is_close(r: dict[str, Any]) -> bool:
    q, wp = _num(r.get("qtr")), _num(r.get("vegas_wp"))
    return q is not None and q <= 4 and wp is not None and LO <= wp <= HI


def is_play(r: dict[str, Any]) -> bool:
    return (r.get("season_type") == "REG" and r.get("posteam") in TEAMS and r.get("play_type") in ("run", "pass")
            and _num(r.get("yards_gained")) is not None)


def tally(rows: list[dict[str, Any]], keep: Callable[[dict[str, Any]], bool]) -> dict[str, dict[str, list[int]]]:
    """team -> {rz:[trips,td], ypp:[plays,yards], third:[att,conv]} over rows passing keep."""
    c = {t: {s: [0, 0] for s in STATS} for t in TEAMS}
    first: dict[tuple, dict[str, Any]] = {}
    for r in rows:
        if rz.is_rz_snap(r):
            first.setdefault((r["game_id"], r["posteam"], int(_num(r["fixed_drive"]))), r)
        if is_play(r) and keep(r):
            t = c[r["posteam"]]
            t["ypp"][0] += 1
            t["ypp"][1] += int(_num(r["yards_gained"]))
            if _num(r.get("down")) == 3:
                t["third"][0] += 1
                t["third"][1] += _num(r.get("third_down_converted")) == 1
    for r in first.values():
        if keep(r):
            if r["posteam"] not in c:
                raise ValueError(f"unknown nflverse team {r['posteam']!r}")
            c[r["posteam"]]["rz"][0] += 1
            c[r["posteam"]]["rz"][1] += r.get("fixed_drive_result") == "Touchdown"
    return c


def view(c: dict[str, dict[str, list[int]]]) -> dict[str, Any]:
    rate = {s: {t: Fraction(v[s][1], v[s][0]) if v[s][0] else Fraction(0) for t, v in c.items()} for s in STATS}
    teams = []
    for t in sorted(c):
        row: dict[str, Any] = {"team": t}
        for s in STATS:
            row[s] = [*c[t][s], 1 + sum(1 for u in c if rate[s][u] > rate[s][t])]
        teams.append(row)
    league: dict[str, Any] = {}
    for s in STATS:
        n, k = sum(v[s][0] for v in c.values()), sum(v[s][1] for v in c.values())
        league[s] = [n, k, round(k / n, 4) if n else 0.0]
    return {"league": league, "teams": teams}


def both(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return {"all": view(tally(rows, lambda r: True)), "close": view(tally(rows, is_close))}


def build(rows: list[dict[str, Any]], source: str = "") -> dict[str, Any]:
    reg = [r for r in rows if r.get("season_type") == "REG"]
    seasons = sorted({int(r["season"]) for r in reg})
    return {
        "schema_version": SCHEMA_VERSION,
        "stub": False,
        "source": source or "nflverse pbp via mining/build_team_garbage_time.py",
        "season_type": "REG",
        "season_list": seasons,
        "close_def": CLOSE_DEF,
        "stats": {"rz": "[red-zone trips, TDs, rank by TD rate]", "ypp": "[plays, yards, rank by yards/play]",
                  "third": "[3rd-down plays, conversions, rank by conversion rate]",
                  "league": "[count, made/yards, rate]"},
        **both(reg),
        "by_season": {str(y): both([r for r in reg if int(r["season"]) == y]) for y in seasons},
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("stub"):
        return []
    out: list[str] = []

    def diff(label: str, o: dict[str, Any], n: dict[str, Any] | None) -> None:
        for v in ("all", "close"):
            if n is None or v not in n:
                out.append(f"{label}:{v}:missing")
                continue
            if o[v]["league"] != n[v]["league"]:
                out.append(f"{label}:{v}:league")
            nt = {t["team"]: t for t in n[v]["teams"]}
            out.extend(f"{label}:{v}:{t['team']}" for t in o[v]["teams"] if nt.get(t["team"]) != t)

    for y, o in old.get("by_season", {}).items():
        diff(y, o, new["by_season"].get(y))
    if old.get("season_list") == new["season_list"]:
        diff("all", old, new)
    return out


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df = df[df["season_type"] == "REG"]
    return json.loads(df.to_json(orient="records"))


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def _source() -> str:
    try:
        sha = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True,
                             text=True, check=True).stdout.strip()
    except Exception:
        sha = "unknown"
    return f"nflverse pbp via mining/build_team_garbage_time.py @ {sha}, built {dt.date.today().isoformat()}"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(load_rows(a.pbp), _source())
    old = json.loads(out.read_text()) if out.exists() else None
    changed = check_frozen(old, new)
    if changed:
        print(f"FAIL: published garbage-time numbers would change: {', '.join(changed[:20])}", file=sys.stderr)
        return 1
    strip = lambda d: {k: v for k, v in d.items() if k != "source"}
    if old is not None and strip(old) == strip(new):
        print(f"{out} unchanged")
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
