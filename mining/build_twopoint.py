"""Build data/site/twopoint.json for B1 concept 1 ("Kick or go for two?" card, NFL Product UI).

Source: nflverse play-by-play 2019-2025 (REG + POST). Shown values are real nflverse rates only
(concept 1: no engine values):
  * two-point tries: two_point_attempt == 1 -> 960 tries, 456 success (47.5%); run 266, pass 681,
    13 "no_play" rows that still carry a result (counted in the overall rate only);
  * extra points: play_type == "extra_point", extra_point_result == "good" -> 9,119 tries.
Per-try rows ("situations") are regulation only (qtr 5 dropped: 3 tries) and carry nflverse vegas_wp at
the try (4 dp). Per-choice win chance (go for 2 vs kick the PAT) is filled by ``--fill-win-chance`` from
the 4th-down engine's WP model (see ``fill_win_chance``); overtime tries never get one (null).
No EPA, xpass, play ids or betting fields. Rows are arrays under "cols" to keep the file small.

Frozen: every published try must stay identical; rates may change only when a season is added.

Usage: python mining/build_twopoint.py PBP_PARQUET [...] [--out data/site/twopoint.json]
       python mining/build_twopoint.py --fill-win-chance [--out data/site/twopoint.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any, Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _frozen import check_frozen as _check  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/twopoint.json"
COLUMNS = ["game_id", "season", "week", "season_type", "posteam", "defteam", "qtr", "time", "play_type",
           "two_point_attempt", "two_point_conv_result", "extra_point_result", "score_differential", "vegas_wp"]
COLS = ["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made", "wp"]
SUMMARY = ("two_point", "extra_point")


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _rate(made: int, tries: int) -> dict[str, Any]:
    return {"tries": tries, "made": made, "rate": round(made / tries, 4) if tries else 0.0}


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tries = [r for r in rows if _num(r.get("two_point_attempt")) == 1]
    xps = [r for r in rows if r.get("play_type") == "extra_point"]
    ok = lambda r: r.get("two_point_conv_result") == "success"  # noqa: E731
    by = lambda k: [r for r in tries if r.get("play_type") == k]  # noqa: E731
    situ = []
    for r in tries:
        if int(r["qtr"]) > 4:
            continue  # no overtime situations / win chance
        situ.append([int(r["season"]), int(r["week"]), r["season_type"], r["game_id"], r["posteam"], r["defteam"],
                     int(r["qtr"]), r["time"], int(r["score_differential"]), r["play_type"], int(ok(r)),
                     round(_num(r["vegas_wp"]), 4) if _num(r.get("vegas_wp")) is not None else None])
    situ.sort(key=lambda s: (s[0], s[1], s[3], s[6], [-int(x) for x in s[7].split(":")]))
    return {
        "schema_version": 1,
        "source": "nflverse play-by-play via mining/build_twopoint.py",
        "season_list": sorted({int(r["season"]) for r in rows}),
        "win_chance": "nflverse win chance (adjusted for pregame expectations) for the scoring team at the try; "
                      "regulation only",
        "two_point": {**_rate(sum(map(ok, tries)), len(tries)),
                      "run": _rate(sum(map(ok, by("run"))), len(by("run"))),
                      "pass": _rate(sum(map(ok, by("pass"))), len(by("pass")))},
        "extra_point": _rate(sum(r.get("extra_point_result") == "good" for r in xps), len(xps)),
        "per_choice_win_chance": None,
        "cols": COLS,
        "tries": situ,
    }


PAT_KICK_DISTANCE = 33  # PAT snapped from the 15: 15 + 18 (engine FG_SNAP_YARDS)
KICKOFF_TOUCHBACK_YARDLINE = 75  # engine's post-score state: opponent ball at its own 25
WC_COLS = ["go", "kick"]
LATE_SECS = 120
LATE_REASON = ("Q4 tries with 0:01-2:00 left are null: the engine's win-chance model misreads the final "
               "minutes (e.g. up 1, TD at 0:02, kick read 0.67 vs ~0.97) and its drive-outcome blending only "
               "covers drives starting inside the 40, not a kickoff at the 25")


def _clock_secs(clock: str) -> int:
    m, s = clock.split(":")
    return int(m) * 60 + int(s)


def wc_key(t: dict[str, Any]) -> str:
    return f"{t['game_id']}|{t['qtr']}|{t['clock']}|{t['team']}"


def after_try_rows(t: dict[str, Any], points: int) -> list[dict[str, Any]]:
    """Engine states right after the try: ``points`` added, opponent receives the kickoff (touchback).
    Try and kickoff take no game clock. Unknown second-half receiver in the first half -> both
    (averaged by the caller), as the engine does for an unknown coin toss. Timeouts unknown -> 3/3."""
    q, qs = int(t["qtr"]), _clock_secs(t["clock"])
    home = t["game_id"].split("_")[-1]
    opp_is_home = t["opp"] == home
    base = {
        "down": 1, "ydstogo": 10, "yardline_100": KICKOFF_TOUCHBACK_YARDLINE,
        "score_differential": -(int(t["diff"]) + points),
        "game_seconds_remaining": (4 - q) * 900 + qs,
        "half_seconds_remaining": (900 if q in (1, 3) else 0) + qs,
        "qtr": q, "posteam_timeouts_remaining": 3, "defteam_timeouts_remaining": 3,
        "posteam": "H" if opp_is_home else "A", "home_team": "H", "away_team": "A",
        "season": int(t["season"]), "roof": "outdoors",
    }
    return [{**base, "receive_2h_ko": r} for r in ((0, 1) if q <= 2 else (0,))]


def fill_win_chance(doc: dict[str, Any], wp: Callable[[dict[str, Any]], float], p_go: float, p_kick: float,
                    meta: dict[str, Any]) -> dict[str, Any]:
    """Expected win chance (scoring team) of each choice: p * WC(made) + (1 - p) * WC(missed), where
    WC(state) = 1 - engine WP of the receiving team after the kickoff. Overtime (qtr > 4) -> null."""
    def wc(t, pts):
        rows = after_try_rows(t, pts)
        if rows[0]["game_seconds_remaining"] == 0:  # regulation over: result known (tie -> 0.5, OT coin flip)
            lead = int(t["diff"]) + pts
            return 1.0 if lead > 0 else 0.0 if lead < 0 else 0.5
        return sum(1.0 - wp(r) for r in rows) / len(rows)

    out: dict[str, Any] = {}
    for row in doc["tries"]:
        t = dict(zip(doc["cols"], row))
        if int(t["qtr"]) > 4:
            out[wc_key(t)] = None
            continue
        if int(t["qtr"]) == 4 and 0 < _clock_secs(t["clock"]) <= LATE_SECS:
            out[wc_key(t)] = None  # late Q4: engine WP unreliable (see LATE_REASON)
            continue
        miss = wc(t, 0)
        go = p_go * wc(t, 2) + (1 - p_go) * miss
        kick = p_kick * wc(t, 1) + (1 - p_kick) * miss
        out[wc_key(t)] = [round(go, 4), round(kick, 4)]
    meta = {**meta, "null_reason": "overtime tries have no win chance; " + LATE_REASON}
    return {**meta, "go_rate": round(p_go, 4), "kick_rate": round(p_kick, 4), "cols": WC_COLS, "by_try": out}


def engine_win_chance(doc: dict[str, Any]) -> dict[str, Any]:
    sys.path.insert(0, str(ROOT / "backend/src"))
    from nfl_sim.products.engine import EMPIRICS_MODE, ENGINE_VERSION, load_engine
    az = load_engine().analyzer  # generic no-spread engine (grid / checker)
    p_kick, _ = az.empirics.p_make(PAT_KICK_DISTANCE, mode=EMPIRICS_MODE)
    p_go = float(doc["two_point"]["rate"])
    meta = {"method": f"{ENGINE_VERSION} win-chance model; expected win chance after each outcome "
                      "(made / missed), opponent then receives a touchback kickoff; regulation only",
            "kick_rate_source": f"engine field-goal make rate at {PAT_KICK_DISTANCE} yd (PAT)",
            "go_rate_source": "nflverse two-point success rate (two_point.rate)"}
    return fill_win_chance(doc, az._wp, p_go, p_kick, meta)


def key(r: dict[str, Any]) -> tuple:
    return (r["game_id"], r["qtr"], r["clock"], r["team"])


def check_frozen(old, new):
    return _check(old, new, key, "tries", SUMMARY)


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd
    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df = df[(df["two_point_attempt"] == 1) | (df["play_type"] == "extra_point")]
    return json.loads(df.to_json(orient="records"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="*")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--fill-win-chance", action="store_true",
                    help="fill per_choice_win_chance in --out from the engine (tries untouched)")
    a = ap.parse_args(argv)
    out = Path(a.out)
    if a.fill_win_chance:
        doc = json.loads(out.read_text())
        before = json.loads(json.dumps(doc["tries"]))
        doc["per_choice_win_chance"] = engine_win_chance(doc)
        assert doc["tries"] == before and not check_frozen(json.loads(out.read_text()), doc)
        out.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
        vals = doc["per_choice_win_chance"]["by_try"].values()
        print(f"filled {sum(v is not None for v in vals)}, null {sum(v is None for v in vals)}")
        return 0
    if not a.pbp:
        ap.error("PBP_PARQUET required")
    new = build(load_rows(a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    bad = check_frozen(old, new)
    if bad:
        print("FAIL: published two-point data would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(new, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['tries'])} tries)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
