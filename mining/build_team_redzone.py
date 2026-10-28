"""Build frontend/lib/teamRedzone.json for F5 (red-zone scorecard, NFL Teams & Games UI).

Shape: RedzoneFile in frontend/lib/teamRedzone.ts (spec: nfl-research/teams/f5-redzone-json-shape.md).

Source: nflverse play-by-play, regular season only. Counts come straight from nflverse fields, nothing
is modelled:
  * a red-zone trip is one nflverse drive (game_id, posteam, fixed_drive) with at least one scrimmage
    snap (play_type run/pass/field_goal/punt/qb_kneel/qb_spike/no_play) at yardline_100 <= 20;
  * td  = fixed_drive_result == "Touchdown"; fg = fixed_drive_result == "Field goal";
  * no_score = everything else (turnover, downs, missed FG, end of half, punt, safety, and
    "Opp touchdown": a defensive TD is a trip worth 0 points).
No EPA, xpass, play ids or betting fields are read or written.

Also writes by_season ("2019".."2025"): the same league + ranked team rows for each regular season.

Frozen data: every season already in the committed by_season, and the all-seasons total when the
season list is unchanged, must be identical (a silent
nflverse regrade fails the build, exit 1). Adding a season is allowed.

Usage: python mining/build_team_redzone.py PBP_PARQUET [...] [--out frontend/lib/teamRedzone.json]
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import math
import subprocess
import sys
from fractions import Fraction
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend/lib/teamRedzone.json"
SCHEMA_VERSION = 1
SNAP_TYPES = frozenset({"run", "pass", "field_goal", "punt", "qb_kneel", "qb_spike", "no_play"})
TEAMS = frozenset("ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA LAC LV MIA MIN NE NO "
                  "NYG NYJ PHI PIT SEA SF TB TEN WAS".split())
RED_ZONE_DEF = "Drive had a snap at the opponent 20 or closer (yardline_100 <= 20)"
COLUMNS = ["game_id", "season", "season_type", "posteam", "fixed_drive", "fixed_drive_result",
           "yardline_100", "play_type"]


class FrozenChanged(Exception):
    pass


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def is_rz_snap(r: dict[str, Any]) -> bool:
    y = _num(r.get("yardline_100"))
    return (r.get("season_type") == "REG" and bool(r.get("posteam")) and r.get("play_type") in SNAP_TYPES
            and y is not None and y <= 20 and _num(r.get("fixed_drive")) is not None)


def rz_drives(rows: Iterable[dict[str, Any]]) -> dict[tuple, tuple[str, str | None]]:
    """(game_id, posteam, fixed_drive) -> (team, fixed_drive_result)."""
    out: dict[tuple, tuple[str, str | None]] = {}
    for r in rows:
        if is_rz_snap(r):
            out.setdefault((r["game_id"], r["posteam"], int(_num(r["fixed_drive"]))),
                           (r["posteam"], r.get("fixed_drive_result")))
    return out


def table(drives: Iterable[tuple[str, str | None]]) -> dict[str, Any]:
    """League totals + 32 ranked team rows for one set of red-zone drives."""
    counts = {t: {"drives": 0, "td": 0, "fg": 0} for t in TEAMS}
    for team, res in drives:
        if team not in counts:
            raise ValueError(f"unknown nflverse team {team!r}")
        c = counts[team]
        c["drives"] += 1
        c["td"] += res == "Touchdown"
        c["fg"] += res == "Field goal"
    rate = {t: Fraction(c["td"], c["drives"]) if c["drives"] else Fraction(0) for t, c in counts.items()}
    teams = []
    for t in sorted(counts, key=lambda t: (-rate[t], t)):
        c = counts[t]
        teams.append({"team": t, "drives": c["drives"], "td": c["td"], "fg": c["fg"],
                      "no_score": c["drives"] - c["td"] - c["fg"], "td_rate": round(float(rate[t]), 4),
                      "rank": 1 + sum(1 for u in counts if rate[u] > rate[t])})
    ld, ltd = sum(c["drives"] for c in counts.values()), sum(c["td"] for c in counts.values())
    return {"league": {"drives": ld, "td": ltd, "td_rate": round(ltd / ld, 4) if ld else 0.0}, "teams": teams}


def build(rows: list[dict[str, Any]], source: str = "") -> dict[str, Any]:
    reg = [r for r in rows if r.get("season_type") == "REG"]
    seasons = sorted({int(r["season"]) for r in reg})
    drives = rz_drives(reg)
    season_of = {r["game_id"]: int(r["season"]) for r in reg}
    allt = table(drives.values())
    return {
        "schema_version": SCHEMA_VERSION,
        "stub": False,
        "source": source or "nflverse pbp via mining/build_team_redzone.py",
        "seasons": [seasons[0], seasons[-1]] if seasons else [],
        "season_type": "REG",
        "red_zone_def": RED_ZONE_DEF,
        "season_list": seasons,
        "league": allt["league"],
        "teams": allt["teams"],
        "by_season": {str(y): table(v for k, v in drives.items() if season_of[k[0]] == y) for y in seasons},
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    """Every season already published must keep identical numbers; the all-seasons total must too
    when the season list is unchanged. Returns labels like "2023:KC" or "all:league"."""
    if not old or old.get("stub"):
        return []

    def diff(label: str, o: dict[str, Any], n: dict[str, Any] | None) -> list[str]:
        if n is None:
            return [f"{label}:missing"]
        bad = [f"{label}:league"] if o.get("league") != n.get("league") else []
        nt = {t["team"]: t for t in n.get("teams", [])}
        return bad + [f"{label}:{t['team']}" for t in o.get("teams", []) if nt.get(t["team"]) != t]

    out: list[str] = []
    for y, o in old.get("by_season", {}).items():
        out += diff(y, o, new["by_season"].get(y))
    if old.get("seasons") == new["seasons"]:
        out += diff("all", old, new)
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
    return f"nflverse pbp via mining/build_team_redzone.py @ {sha}, built {dt.date.today().isoformat()}"


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
        print(f"FAIL: published red-zone numbers would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    if old is not None and {k: v for k, v in old.items() if k != "source"} == \
            {k: v for k, v in new.items() if k != "source"}:
        print(f"{out} unchanged")
        return 0
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes, {new['league']['drives']} drives)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
