"""Build data/site/gorates.json (schema gorates/v1) for D6: coaches' real 4th-down go-rates.

Source: nflverse play-by-play 2019-2025, REG+POST. Engine layer (H6 #168 merged): our 4th-down engine's
best call for the same plays, read from the per-play `fourth` data in the released game files.

Filter (/workspace/nfl-research/charts/d6-data-shape.md):
  * down == 4, play_type in run, pass, punt, field_goal, yardline_100 not null;
  * regulation only (qtr 1-4);
  * field goal tries over 64 yards are left out (house FG cap; 6 in regulation 2019-2025).
cells[distance-1][band] = [plays, went, fieldGoals, punts]; distance = ydstogo 1..10 (10 = 10 or more),
band = yardline_100 in 10-yard bands 1-10 ... 91-99. went = run or pass.

Engine layer (additive; schema stays gorates/v1, every field above is unchanged):
engineCells[distance-1][band] = [rated, engineGo, engineKick, enginePunt, closeCalls, wentWhenEngineGo]
over the same kept plays as cells. rated = plays with an engine call; engineGo + engineKick + enginePunt =
rated; closeCalls = best and next-best call within 2 points of win chance; wentWhenEngineGo = coaches went
for it when the engine said go. Win chance only: gap sizes and point values are never written.

Frozen data: the build exits 1 if any published cell would change, even if the season span changes,
or if the engine layer (engineCells or engine version) would change, also whatever the season span; a new
engine needs an approved republish (--engine-republish).

Usage: python mining/build_gorates.py PBP_PARQUET [...] --games-dir frontend/public/data/games
       [--games-tag games-v7] [--out data/site/gorates.json] [--engine-republish]
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_stamp import stamp  # noqa: E402

import _frozen as fz  # noqa: E402
from _frozen import read_pbp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/gorates.json"
SCHEMA = "gorates/v1"
MAX_FG = 64
MIN_PLAYS = 10
DISTANCES = list(range(1, 11))
BANDS = [(lo, min(lo + 9, 99)) for lo in range(1, 100, 10)]
COLUMNS = ["season", "game_date", "qtr", "down", "ydstogo", "yardline_100", "play_type", "kick_distance",
           "game_id", "play_id"]
ENGINE_FIELDS = ["rated", "engineGo", "engineKick", "enginePunt", "closeCalls", "wentWhenEngineGo"]
ENGINE_SLOT = {"go": 1, "fg": 2, "punt": 3}
CLOSE_CALL_PCT = 2  # nfl_sim.products.engine.CLOSE_CALL_PTS: points of win chance


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def keep(r: dict[str, Any]) -> bool:
    qtr = _num(r.get("qtr"))
    if _num(r.get("down")) != 4 or qtr is None or not 1 <= qtr <= 4:
        return False
    if r.get("play_type") not in ("run", "pass", "punt", "field_goal") or _num(r.get("yardline_100")) is None:
        return False
    if (_num(r.get("ydstogo")) or 0) < 1:
        return False
    return not (r["play_type"] == "field_goal" and (_num(r.get("kick_distance")) or 0) > MAX_FG)


def band_index(yl: float) -> int:
    return min(int((yl - 1) // 10), len(BANDS) - 1)


def load_engine_calls(games_dir: str) -> tuple[str, dict[tuple[str, int], tuple[str, int]]]:
    """(engine_version, {(game_id, play_id): (best call, close call 0/1)}) from game.v2 files.

    `fourth` is keyed by row index into `cols`: [recommendation, close_call, gap_pts, wp, actual, is_home_offense].
    Only the call and the close-call flag are read."""
    calls: dict[tuple[str, int], tuple[str, int]] = {}
    versions = set()
    for name in sorted(os.listdir(games_dir)):
        if not (name.startswith("20") and name.endswith(".json") and name.count("_") >= 3):
            continue
        doc = json.loads((Path(games_dir) / name).read_text())
        gid, pid = doc["game"]["id"], doc["cols"]["play_id"]
        for i, f in doc["fourth"].items():
            calls[(gid, int(pid[int(i)]))] = (f[0], int(f[1]))
        if doc["fourth"]:
            versions.add(doc["engine_version"])
    if len(versions) != 1:
        raise SystemExit(f"FAIL: expected one engine version in {games_dir}, got {sorted(versions)}")
    return versions.pop(), calls


def build_engine(rows: list[dict[str, Any]], version: str, calls: dict[tuple[str, int], tuple[str, int]],
                 data_through: str, games_tag: str) -> dict[str, Any]:
    cells = [[[0] * len(ENGINE_FIELDS) for _ in BANDS] for _ in DISTANCES]
    for r in rows:
        if not keep(r):
            continue
        call = calls.get((str(r.get("game_id")), int(_num(r.get("play_id")) or -1)))
        if call is None:
            continue
        rec, close = call
        c = cells[min(int(r["ydstogo"]), 10) - 1][band_index(float(r["yardline_100"]))]
        c[0] += 1
        c[ENGINE_SLOT[rec]] += 1
        c[4] += close
        c[5] += int(rec == "go" and r["play_type"] in ("run", "pass"))
    return {
        "engine": {"version": version,
                   "source": f"Our 4th-down engine's best call for the same plays as cells, from the {games_tag} game files",
                   "dataThrough": data_through, "closeCallPct": CLOSE_CALL_PCT, "fields": ENGINE_FIELDS},
        "engineCells": cells,
    }


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    seasons = sorted({int(r["season"]) for r in rows})
    cells = [[[0, 0, 0, 0] for _ in BANDS] for _ in DISTANCES]
    last = ""
    for r in rows:
        last = max(last, str(r.get("game_date") or ""))
        if not keep(r):
            continue
        c = cells[min(int(r["ydstogo"]), 10) - 1][band_index(float(r["yardline_100"]))]
        pt = r["play_type"]
        c[0] += 1
        c[1] += int(pt in ("run", "pass"))
        c[2] += int(pt == "field_goal")
        c[3] += int(pt == "punt")
    span = f"{seasons[0]}-{seasons[-1]}" if seasons else ""
    return {
        "schema": SCHEMA,
        "source": f"nflverse play-by-play {span} (CC BY 4.0), REG+POST, regulation only: 4th downs that ran a run, "
                  "pass, punt or field goal (field goals over 64 yd left out); went for it = run or pass",
        "builtAt": "",
        "dataThrough": last[:10],
        "seasons": [seasons[0], seasons[-1]] if seasons else [],
        "minPlays": MIN_PLAYS,
        "maxFgYards": MAX_FG,
        "distances": DISTANCES,
        "bands": [{"min": lo, "max": hi} for lo, hi in BANDS],
        "cells": cells,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    """Every published cell is frozen 2019-2025 data, whatever the new season span (no span-change skip:
    an open season needs its own slice, 2026 PR4)."""
    if not old or old.get("schema") != new["schema"]:
        return []
    changed = [f"{d}-{b}" for d, row in enumerate(old.get("cells", []), 1) for b, c in enumerate(row)
               if new["cells"][d - 1][b] != c]
    return changed + [k for k in ("distances", "bands") if old.get(k) != new[k]]


def check_engine_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    """Published engine cells and engine version never move without an approved republish."""
    if not old or "engineCells" not in old:
        return []  # first engine publish; a season-span change no longer skips this check (2026 PR1)
    if old["engine"]["version"] != new["engine"]["version"]:
        return [f"engine {old['engine']['version']} -> {new['engine']['version']}"]
    return [f"engine {d}-{b}" for d, row in enumerate(old["engineCells"], 1) for b, c in enumerate(row)
            if new["engineCells"][d - 1][b] != c]


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = read_pbp(paths, COLUMNS)
    last = df.game_date.astype(str).max()
    df = df[df.down == 4].copy()
    df["game_date"] = df["game_date"].astype(str)
    rows = json.loads(df.to_json(orient="records"))
    rows.append({"season": int(df.season.max()), "game_date": last})
    return rows


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--games-dir", required=True, help="released game files (scripts/pages/game_files_release.sh fetch)")
    ap.add_argument("--games-tag", default=os.environ.get("GAMES_RELEASE_TAG", ""))
    ap.add_argument("--engine-republish", action="store_true", help="approved engine republish: allow engine changes")
    a = ap.parse_args(argv)
    if not a.games_tag:
        ap.error("--games-tag (or GAMES_RELEASE_TAG) is required")
    out = Path(a.out)
    rows = load_rows(a.pbp)
    new = build(rows)
    version, calls = load_engine_calls(a.games_dir)
    new.update(build_engine(rows, version, calls, new["dataThrough"], a.games_tag))
    old = json.loads(out.read_text()) if out.exists() else None
    changed = check_frozen(old, new) + ([] if a.engine_republish else check_engine_frozen(old, new))
    if changed:
        print(f"FAIL: published go-rate cells would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    new = stamp(new, old)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
