"""Build data/site/fakes.json for B2 ("Real punt or fake?" card, NFL Product UI).

Source: nflverse play-by-play 2019-2025 (REG + POST). A fake punt is exactly the plan's query:
down == 4, desc contains "Punt formation" (case-insensitive), play_type in (run, pass).
That yields 162 plays (155 REG, 7 POST; none in overtime), 90 with first_down == 1 (55.6%).
Values are copied from nflverse; win chance is nflverse vegas_wp at the snap (rounded to 4 dp),
null in overtime. No EPA, xpass, play ids or betting fields.

Frozen: every published fake must stay identical; summary numbers may change only when a season is
added. Exit 1 otherwise.

Decoys (real_punts): 300 regulation 4th-down punts, stratified to the fakes' quarter/togo/yard-line mix
with a fixed seed; first_down is null. punt_count = all nflverse punts (play_type == 'punt'). Decoys are
frozen too: adding a season that would reshuffle them fails the guard (rebuild deliberately then).

Usage: python mining/build_fakes.py PBP_PARQUET [...] [--out data/site/fakes.json]
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _frozen import check_frozen as _check  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/fakes.json"
COLUMNS = ["game_id", "season", "week", "season_type", "posteam", "defteam", "qtr", "time", "down", "ydstogo",
           "yardline_100", "play_type", "desc", "first_down", "vegas_wp", "posteam_score", "defteam_score"]
SUMMARY = ("count", "first_downs", "first_down_rate", "by_season", "punt_count")
DECOYS = 300
SEED = 20261028
TOGO_BINS = ((1, 1), (2, 3), (4, 6), (7, 10), (11, 99))
YL_BINS = ((1, 40), (41, 50), (51, 60), (61, 70), (71, 99))


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def is_fake(r: dict[str, Any]) -> bool:
    return (_num(r.get("down")) == 4 and r.get("play_type") in ("run", "pass")
            and "punt formation" in (r.get("desc") or "").lower())


def record(r: dict[str, Any]) -> dict[str, Any]:
    qtr, wp = int(r["qtr"]), _num(r.get("vegas_wp"))
    return {"season": int(r["season"]), "week": int(r["week"]), "season_type": r["season_type"],
            "game_id": r["game_id"], "team": r["posteam"], "opp": r["defteam"], "qtr": qtr, "clock": r["time"],
            "down": 4, "togo": int(r["ydstogo"]), "yardline_100": int(r["yardline_100"]),
            "score": int(r["posteam_score"]), "opp_score": int(r["defteam_score"]),
            "kind": r["play_type"], "first_down": int(_num(r.get("first_down")) or 0),
            "wp": round(wp, 4) if wp is not None and qtr <= 4 else None, "desc": r["desc"]}


def is_real_punt(r: dict[str, Any]) -> bool:
    q = _num(r.get("qtr"))
    return r.get("play_type") == "punt" and _num(r.get("down")) == 4 and q is not None and q <= 4


def _bin(v: int, bins) -> int:
    return next(i for i, (lo, hi) in enumerate(bins) if lo <= v <= hi)


def stratum(p: dict[str, Any]) -> tuple[int, int, int]:
    return (p["qtr"], _bin(p["togo"], TOGO_BINS), _bin(p["yardline_100"], YL_BINS))


def sample_decoys(fakes: list[dict], punts: list[dict], n: int = DECOYS, seed: int = SEED) -> list[dict]:
    """Stratified by (quarter, togo bin, yardline_100 bin) in proportion to the fakes; largest-remainder
    allocation; fixed seed over a sorted pool so the sample is deterministic."""
    import random
    from collections import Counter, defaultdict

    want = Counter(stratum(f) for f in fakes if f["qtr"] <= 4)
    tot = sum(want.values())
    raw = {s: n * c / tot for s, c in want.items()}
    alloc = {s: int(v) for s, v in raw.items()}
    for s in sorted(raw, key=lambda s: (-(raw[s] - alloc[s]), s))[: n - sum(alloc.values())]:
        alloc[s] += 1
    pool = defaultdict(list)
    for p in punts:
        pool[stratum(p)].append(p)
    rng = random.Random(seed)
    out = []
    for s in sorted(alloc):
        cand = sorted(pool[s], key=key)
        out += rng.sample(cand, min(alloc[s], len(cand)))
    return out


def key(r: dict[str, Any]) -> tuple:
    return (r["game_id"], r["qtr"], r["clock"], r["team"])


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    order = lambda p: (p["season"], p["week"], p["game_id"], p["qtr"], [-int(x) for x in p["clock"].split(":")])  # noqa: E731
    plays = sorted((record(r) for r in rows if is_fake(r)), key=order)
    punts = [{**record(r), "first_down": None} for r in rows if is_real_punt(r)]
    decoys = sorted(sample_decoys(plays, punts), key=order)
    seasons = sorted({int(r["season"]) for r in rows})
    fd = sum(p["first_down"] for p in plays)
    return {
        "schema_version": 1,
        "source": "nflverse play-by-play via mining/build_fakes.py",
        "season_list": seasons,
        "def": "4th down, play text has 'Punt formation', run or pass (REG + playoffs)",
        "win_chance": "nflverse win chance (adjusted for pregame expectations) at the snap; none in overtime",
        "count": len(plays), "first_downs": fd, "first_down_rate": round(fd / len(plays), 4) if plays else 0.0,
        "by_season": {str(y): sum(p["season"] == y for p in plays) for y in seasons},
        "punt_count": sum(1 for r in rows if r.get("play_type") == "punt"),
        "decoy_rule": f"{DECOYS} regulation real punts (4th down), stratified to the fakes' quarter x togo x "
                      f"yardline_100 mix, seed {SEED}",
        "plays": plays,
        "real_punts": decoys,
    }


def check_frozen(old, new):
    return _check(old, new, key, "plays", SUMMARY) + _check(old, new, key, "real_punts")


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd
    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    df = df[(df["play_type"] == "punt") | ((df["down"] == 4) & df["play_type"].isin(["run", "pass"]))]
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
        print("FAIL: published fakes would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(new, separators=(",", ":"), ensure_ascii=False) + "\n")
    print(f"wrote {out} ({out.stat().st_size} bytes, {new['count']} fakes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
