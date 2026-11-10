"""Build data/site/weather.json for G6 Weather badge (Game Story header).

Source: nflverse play-by-play 2019-2025 (REG+POST): game-level roof, temp (F), wind (mph), final scores.
A game gets weather only when nflverse roof is "outdoors" or "open" and both temp and wind are present; dome,
closed-roof and missing-weather games are absent from ``games``; dome/closed-roof games are listed in
``indoors`` (nflverse roof) so the badge can say "Indoors". 2022_17_BUF_CIN (suspended) is left out.
``bands`` are average total points per wind band and per temperature band over those games, so the badge
can say e.g. "Games this windy averaged 42.3 points". No play ids, EPA, win chance or betting fields.

Frozen: a published game's weather and the band numbers never change; new games and indoors entries only
from an open season past the watermark (mining/_frozen.py).

Usage: python mining/build_weather.py PBP_PARQUET [...] [--out data/site/weather.json]
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

import _frozen as fz  # noqa: E402
from _frozen import read_pbp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/weather.json"
SCHEMA = "weather/v1"
NO_RESULT_GAME = "2022_17_BUF_CIN"
OPEN_AIR = ("outdoors", "open")
WIND_BANDS = [(0, 9), (10, 14), (15, 19), (20, None)]
TEMP_BANDS = [(None, 32), (33, 50), (51, 70), (71, None)]
COLUMNS = ["game_id", "game_date", "roof", "temp", "wind", "home_score", "away_score"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _band(rows: list[tuple[int, int]], lo: int | None, hi: int | None, key: str) -> dict[str, Any]:
    pts = [p for v, p in rows if (lo is None or v >= lo) and (hi is None or v <= hi)]
    return {key: [lo, hi], "games": len(pts), "avg_points": round(sum(pts) / len(pts), 1) if pts else None}


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    games: dict[str, dict[str, Any]] = {}
    for r in rows:
        if r["game_id"] != NO_RESULT_GAME:
            games.setdefault(r["game_id"], r)
    out: dict[str, list[int]] = {}
    wind, temp = [], []
    indoors = sorted(gid for gid, g in games.items() if g.get("roof") in ("dome", "closed"))
    for gid, g in sorted(games.items()):
        t, w = _num(g.get("temp")), _num(g.get("wind"))
        if g.get("roof") not in OPEN_AIR or t is None or w is None:
            continue
        pts = int(g["home_score"]) + int(g["away_score"])
        out[gid] = [int(w), int(t)]
        wind.append((int(w), pts))
        temp.append((int(t), pts))
    last = max(str(g.get("game_date") or "")[:10] for g in games.values())
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG+POST; open-air games (roof outdoors/open) with weather",
        "builtAt": "",
        "dataThrough": last,
        "season_list": sorted({int(gid[:4]) for gid in games}),
        "cols": ["wind_mph", "temp_f"],
        "bands": {"wind": [_band(wind, lo, hi, "mph") for lo, hi in WIND_BANDS],
                  "temp": [_band(temp, lo, hi, "f") for lo, hi in TEMP_BANDS]},
        "games": out,
        "indoors": indoors,
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    if not old or old.get("schema") != new["schema"]:
        return []
    bad = [g for g, v in old["games"].items() if new["games"].get(g) != v]
    bad += ["bands"] if old["bands"] != new["bands"] else []  # frozen whatever the season list
    bad += [f"games added: {g}" for g in new["games"] if g not in old["games"] and fz.is_frozen_game(g, "weather")]
    if "indoors" in old:
        ni = new.get("indoors") or []
        bad += ["indoors"] if ni[:len(old["indoors"])] != old["indoors"] else []  # append-only
        bad += [f"indoors added: {g}" for g in ni[len(old["indoors"]):] if fz.is_frozen_game(g, "weather")]
    return bad


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    df = read_pbp(paths, COLUMNS)
    df = df.drop_duplicates("game_id")
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
        print("FAIL: published weather data would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(stamp(new, old)))
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['games'])} games)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
