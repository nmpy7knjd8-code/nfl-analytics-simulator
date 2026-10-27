"""game.v2: compact, columnar per-game file. Lossless vs game.v1 except floats rounded to 3 dp.

Dropped because derivable (expand() restores them):
  home_wp_after      = next play's home_wp; last play = final_home_wp
  swing              = play_id in swing_play_ids
  fourth_down.home_wp = wp when is_home_offense, else 1 − wp
  fourth_down.options = keys of wp;  kick_distance = yardline_100 + FG_SNAP_YARDS;  engine_version → top level
  clock "mm:ss"      → seconds left in the quarter (int)
Per-file provenance is cut to source / data_sha256 / build_date (full provenance in games/{season}.json).
"""
from __future__ import annotations

FG_SNAP_YARDS = 18
COLS = ("play_id", "qtr", "sec", "posteam", "down", "ydstogo", "yardline_100", "text", "play_type",
        "home_wp", "home_score", "away_score")


def _sec(clock: str | None) -> int | None:
    if clock is None:
        return None
    m, s = clock.split(":")
    return int(m) * 60 + int(s)


def _clock(sec: int | None) -> str | None:
    if sec is None:
        return None
    return f"{sec // 60}:{sec % 60:02d}"


def _r(x, nd=3):
    return None if x is None else round(float(x), nd)


def compact(doc: dict) -> dict:
    plays = doc["plays"]
    cols = {c: [] for c in COLS}
    fourth: dict[str, list] = {}
    engine_version = None
    for i, p in enumerate(plays):
        row = {**p, "sec": _sec(p["clock"]), "home_wp": _r(p["home_wp"])}
        for c in COLS:
            cols[c].append(row[c])
        fd = p.get("fourth_down")
        if fd:
            engine_version = fd.get("engine_version", engine_version)
            fourth[str(i)] = [fd["recommendation"], int(bool(fd["close_call"])), _r(fd["gap_pts"], 2),
                              {k: _r(v) for k, v in fd["wp"].items()}, fd.get("actual"),
                              # home offense? (team codes can differ, e.g. 2019 posteam LV vs schedule OAK)
                              int(all(abs(fd["home_wp"][k] - v) < 1e-9 for k, v in fd["wp"].items()) and fd["wp"] != {k: 0.5 for k in fd["wp"]})]
    prov = doc["provenance"]
    return {
        "schema_version": "game.v2", "provenance": {k: prov[k] for k in ("source", "data_sha256", "build_date") if k in prov},
        "game": doc["game"], "wp_perspective": doc["wp_perspective"], "swing_threshold": doc["swing_threshold"],
        "final_home_wp": _r(doc["final_home_wp"]), "swing_play_ids": doc["swing_play_ids"],
        "engine_version": engine_version, "fourth_cols": ["recommendation", "close_call", "gap_pts", "wp", "actual", "is_home_offense"],
        "cols": cols, "fourth": fourth,
    }


def expand(doc: dict) -> dict:
    """game.v2 → game.v1 shape (what #57's GameFile reads)."""
    c, n = doc["cols"], len(doc["cols"]["play_id"])
    swings = set(doc["swing_play_ids"])
    plays = []
    for i in range(n):
        p = {k: c[k][i] for k in COLS if k != "sec"}
        p["clock"] = _clock(c["sec"][i])
        nxt = c["home_wp"][i + 1] if i + 1 < n else doc["final_home_wp"]
        p["home_wp_after"] = nxt
        p["swing"] = p["play_id"] in swings
        f = doc["fourth"].get(str(i))
        if f:
            rec, close, gap, wp, actual, is_home = f
            hw = {k: (v if is_home else round(1 - v, 3)) for k, v in wp.items()}
            p["fourth_down"] = {"recommendation": rec, "close_call": bool(close), "gap_pts": gap, "wp": wp,
                                "home_wp": hw, "options": [o for o in ("go", "fg", "punt") if o in wp], "actual": actual,
                                "kick_distance": None if p["yardline_100"] is None else p["yardline_100"] + FG_SNAP_YARDS,
                                "engine_version": doc.get("engine_version")}
        else:
            p["fourth_down"] = None
        plays.append(p)
    return {**{k: doc[k] for k in ("provenance", "game", "wp_perspective", "swing_threshold", "final_home_wp",
                                    "swing_play_ids")}, "schema_version": "game.v1", "plays": plays}
