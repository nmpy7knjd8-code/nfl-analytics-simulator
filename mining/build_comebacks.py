"""Build data/site/comebacks.json for D1 Comeback Index (NFL Stories UI).

Source: nflverse play-by-play 2019-2025, REG+POST. Win chance is Vegas-adjusted (vegas_home_wp, house rule),
copied from nflverse and never recomputed. For every decided game (no ties; 2022_17_BUF_CIN has no result)
the winner's lowest chance to win is taken from regulation rows only (qtr 1-4, win chance not null), so a
game won in overtime counts but its low point is never an overtime row. The bad 2019_03_CIN_BUF
"End of half" row and the row right before it are dropped (same rule as swings.json).

Output (small): ``lows`` = every decided game's low point (winner's chance, 4 dp, ascending) for the
"Could you have quit?" slider count; ``top`` = the TOP lowest games with a 24-point regulation sparkline of
the winner's chance (whole percent). No play ids, EPA or betting fields; no overtime win chance.

Frozen: published ``top`` rows and the decided-game count may not change unless a season is added.

Usage: python mining/build_comebacks.py PBP_PARQUET [...] [--out data/site/comebacks.json]
       [--allow-changes mining/frozen_overrides/<file>.json]  (listed games may change only spark)
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
from build_stamp import stamp  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/site/comebacks.json"
SCHEMA = "comebacks/v1"
TOP = 50
SPARK = 24
REG = 3600
NO_RESULT_GAME = "2022_17_BUF_CIN"
BAD_ROW_GAME = "2019_03_CIN_BUF"
COLS = ["season", "week", "season_type", "game_id", "winner", "loser", "winner_score", "loser_score", "ot",
        "low", "low_qtr", "low_clock", "spark"]
COLUMNS = ["game_id", "season", "week", "season_type", "game_date", "home_team", "away_team", "home_score",
           "away_score", "qtr", "time", "game_seconds_remaining", "vegas_home_wp", "desc"]


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def drop_bad_rows(rs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """rs: one game's rows in nflverse order. Drops the 2019_03_CIN_BUF "End of half" row and the row before it."""
    bad = set()
    for i, r in enumerate(rs):
        if r["game_id"] == BAD_ROW_GAME and str(r.get("desc") or "").startswith("End of half"):
            bad |= {i, i - 1}
    return [r for i, r in enumerate(rs) if i not in bad]


def game_entry(rs: list[dict[str, Any]]) -> list[Any] | None:
    f = rs[0]
    hs, as_ = int(f["home_score"]), int(f["away_score"])
    if hs == as_:
        return None
    home_won = hs > as_
    reg = [r for r in drop_bad_rows(rs) if _num(r.get("qtr")) is not None and 1 <= _num(r["qtr"]) <= 4
           and _num(r.get("vegas_home_wp")) is not None and _num(r.get("game_seconds_remaining")) is not None]
    if not reg:
        return None
    reg.sort(key=lambda r: (_num(r["qtr"]), -_num(r["game_seconds_remaining"])))  # game clock; stable
    w = lambda r: _num(r["vegas_home_wp"]) if home_won else 1 - _num(r["vegas_home_wp"])  # noqa: E731
    low = min(reg, key=w)  # first row reaching the minimum
    spark, j = [], 0
    for i in range(SPARK):
        t = i * REG / (SPARK - 1)
        while j + 1 < len(reg) and REG - _num(reg[j + 1]["game_seconds_remaining"]) <= t:
            j += 1
        spark.append(round(100 * w(reg[j])))
    ot = any(_num(r.get("qtr")) == 5 for r in rs)
    if not ot:
        spark[-1] = 100  # regulation final: the winner's line ends at 100
    # The stated low must show: the sample nearest the low's game time takes the low's value (length stays SPARK).
    lt = REG - _num(low["game_seconds_remaining"])
    last = SPARK - 1 if ot else SPARK - 2  # never the regulation-final 100
    k = min(range(last + 1), key=lambda i: abs(i * REG / (SPARK - 1) - lt))
    spark[k] = round(100 * w(low))
    win, lose = (f["home_team"], f["away_team"]) if home_won else (f["away_team"], f["home_team"])
    return [int(f["season"]), int(f["week"]), f["season_type"], f["game_id"], win, lose, max(hs, as_),
            min(hs, as_), ot, round(w(low), 4), int(_num(low["qtr"])), low["time"], spark]


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    games: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        if r.get("game_id") != NO_RESULT_GAME:
            games.setdefault(r["game_id"], []).append(r)
    entries = [e for rs in games.values() if (e := game_entry(rs))]
    li = COLS.index("low")
    entries.sort(key=lambda e: (e[li], e[3]))
    last = max(str(r.get("game_date") or "") for r in rows)
    return {
        "schema": SCHEMA,
        "source": "nflverse play-by-play (CC BY 4.0), REG+POST, nflverse win chance adjusted for pregame "
                  "expectations; regulation rows only",
        "builtAt": "",
        "dataThrough": last[:10],
        "season_list": sorted({int(r["season"]) for r in rows}),
        "decided_games": len(entries),
        "spark_points": SPARK,
        "lows": [e[li] for e in entries],
        "cols": COLS,
        "top": entries[:TOP],
    }


def key(r: dict[str, Any]) -> tuple:
    return (r["game_id"],)


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any], allowed: set[str] = frozenset()) -> list[str]:
    """`allowed` games (a reviewed override) may change only their spark array."""
    if not old or old.get("schema") != new["schema"]:
        return []
    if allowed:
        si = COLS.index("spark")
        nk = {e[3]: e for e in new.get("top", [])}
        bad = [f"{e[3]} (override: changed more than spark)" for e in old.get("top", [])
               if e[3] in allowed and e[3] in nk and (e[:si] + e[si + 1:]) != (nk[e[3]][:si] + nk[e[3]][si + 1:])]
        old = {**old, "top": [nk[e[3]] if e[3] in allowed and e[3] in nk else e for e in old.get("top", [])]}
        return bad + _check(old, new, key, "top", ("decided_games", "lows"))
    return _check(old, new, key, "top", ("decided_games", "lows"))


def load_override(path: str | None) -> set[str]:
    if not path:
        return set()
    o = json.loads(Path(path).read_text())
    if not o.get("reason") or not o.get("approved_by") or not isinstance(o.get("games"), list):
        raise SystemExit(f"override {path} needs reason, approved_by and a games list")
    return set(o["games"])


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
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--allow-changes", default=None)
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(load_rows(a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    bad = check_frozen(old, new, load_override(a.allow_changes))
    if bad:
        print("FAIL: published comebacks would change: " + "; ".join(bad[:10]), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(stamp(new, old)))
    print(f"wrote {out} ({out.stat().st_size} bytes, {new['decided_games']} decided games)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
