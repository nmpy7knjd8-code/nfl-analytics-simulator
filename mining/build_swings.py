"""Build data/site/swings.json for C2 (Swing of the Week) and C3 (Biggest regulation swings).

Source: nflverse play-by-play 2019-2025, Vegas-adjusted win chance (vegas_wp / vegas_wpa),
values copied from nflverse (rounded to 4 decimals only), never recomputed.

Shared swing filter (build-plan C2/C3, creative-builds.md Group C):
  * regulation only (qtr 1-4): no overtime win chance anywhere;
  * play_type in run, pass, field_goal, punt (drops kickoffs, non-play rows, timeouts);
  * no kneels or spikes; rows without nflverse vegas_wp/vegas_wpa are skipped (no fallback model);
  * field goals over 64 yards are skipped (house FG cap);
  * the whole 2019_03_CIN_BUF game is left out (bad "End of half" row + the play before it carry
    fake swings; scripts/acceptance/house_rules.py bans the game id from site data).

Fan-facing fields carry no EPA, xpass, play ids or betting fields. "swing" is the change in the
offense's chance to win (0-1 scale; the UI shows x100 as "chance to win swung N points").

Frozen weeks: a week already in the committed swings.json must not change; the build exits 1
if it would (new data only adds weeks).

Usage: python mining/build_swings.py PBP_PARQUET [PBP_PARQUET ...] [--out data/site/swings.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/swings.json"
SCHEMA_VERSION = 1
SWING_PLAY_TYPES = frozenset({"run", "pass", "field_goal", "punt"})
BAD_GAME = "2019_03_CIN_BUF"
MAX_FG = 64
TOP_N = 25
ROUNDS = ("WC", "DIV", "CONF", "SB")
COLUMNS = ["game_id", "season", "week", "season_type", "home_team", "away_team", "posteam", "qtr", "time",
           "down", "ydstogo", "yardline_100", "play_type", "desc", "qb_kneel", "qb_spike", "kick_distance",
           "vegas_wp", "vegas_wpa", "play_id"]


class FrozenWeekChanged(Exception):
    pass


def _num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def is_swing_candidate(r: dict[str, Any]) -> bool:
    qtr = _num(r.get("qtr"))
    if r.get("game_id") == BAD_GAME or qtr is None or not 1 <= qtr <= 4:
        return False
    if r.get("play_type") not in SWING_PLAY_TYPES or _num(r.get("qb_kneel")) or _num(r.get("qb_spike")):
        return False
    if r.get("play_type") == "field_goal" and (_num(r.get("kick_distance")) or 0) > MAX_FG:
        return False
    return _num(r.get("vegas_wp")) is not None and _num(r.get("vegas_wpa")) is not None and bool(r.get("posteam"))


def week_key(r: dict[str, Any]) -> str:
    return f"{int(r['season'])}-w{int(r['week']):02d}"


def _round4(v: float) -> float:
    return round(v, 4)


def swing_record(r: dict[str, Any], post_rounds: dict[tuple[int, int], str]) -> dict[str, Any]:
    wp, wpa = float(r["vegas_wp"]), float(r["vegas_wpa"])
    season, week = int(r["season"]), int(r["week"])
    return {
        "season": season, "week": week, "round": post_rounds.get((season, week)),
        "game_id": r["game_id"], "home": r["home_team"], "away": r["away_team"], "team": r["posteam"],
        "qtr": int(r["qtr"]), "clock": r["time"],
        "down": None if _num(r.get("down")) is None else int(r["down"]),
        "togo": None if _num(r.get("ydstogo")) is None else int(r["ydstogo"]),
        "yardline_100": None if _num(r.get("yardline_100")) is None else int(r["yardline_100"]),
        "play_type": r["play_type"], "desc": r["desc"],
        "wp_before": _round4(wp), "wp_after": _round4(min(1.0, max(0.0, wp + wpa))), "swing": _round4(wpa),
    }


def _rank_key(r: dict[str, Any]) -> tuple:
    # biggest |swing| first; deterministic tie-break on game and nflverse row order (play_id not exported)
    return (-abs(float(r["vegas_wpa"])), r["game_id"], float(r.get("play_id") or 0))


def post_round_map(rows: Iterable[dict[str, Any]]) -> dict[tuple[int, int], str]:
    weeks: dict[int, set[int]] = {}
    for r in rows:
        if r.get("season_type") == "POST":
            weeks.setdefault(int(r["season"]), set()).add(int(r["week"]))
    return {(s, w): ROUNDS[i] for s, ws in weeks.items() for i, w in enumerate(sorted(ws)) if i < len(ROUNDS)}


def build(rows: list[dict[str, Any]], top_n: int = TOP_N) -> dict[str, Any]:
    rounds = post_round_map(rows)
    cands = sorted((r for r in rows if is_swing_candidate(r)), key=_rank_key)
    weeks: dict[str, dict[str, Any]] = {}
    for r in cands:  # already ranked: first seen per week is that week's biggest swing
        weeks.setdefault(week_key(r), swing_record(r, rounds))
    seasons = sorted({int(r["season"]) for r in rows})
    return {
        "v": SCHEMA_VERSION,
        "source": f"nflverse play-by-play {seasons[0]}-{seasons[-1]}" if seasons else "nflverse play-by-play",
        "win_chance": "nflverse win chance (adjusted for pregame expectations); regulation only",
        "filter": "regulation run/pass/field goal/punt; no kneels, spikes, overtime or field goals over 64 yd",
        "weeks": dict(sorted(weeks.items())),
        "top": [swing_record(r, rounds) for r in cands[:top_n]],
    }


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any]) -> list[str]:
    """Weeks already published must be identical in the new build."""
    if not old:
        return []
    return [k for k, v in old.get("weeks", {}).items() if new["weeks"].get(k) != v]


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    frames = []
    for p in paths:
        frames.append(pd.read_parquet(p, columns=COLUMNS))
    df = pd.concat(frames, ignore_index=True)
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
    changed = check_frozen(old, new)
    if changed:
        print(f"FAIL: published weeks would change: {', '.join(changed)}", file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['weeks'])} weeks, top {len(new['top'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
