"""Build data/site/swings.json for C2 (Swing of the Week) and C3 (Biggest regulation swings).

Source: nflverse play-by-play 2019-2025, Vegas-adjusted win chance (vegas_wp / vegas_home_wp),
values copied from nflverse (rounded to 4 decimals only), never recomputed.

Shared swing filter (build-plan C2/C3, creative-builds.md Group C):
  * regulation only (qtr 1-4): no overtime win chance anywhere;
  * play_type in run, pass, field_goal, punt (drops kickoffs, non-play rows, timeouts);
  * no kneels or spikes; rows without nflverse vegas_wp are skipped (no fallback model);
  * field goals over 64 yards are skipped (house FG cap);
  * 2019_03_CIN_BUF: its bad "End of half" row and the play right before it (a Dalton pass
    carrying a fake +86.6 swing measured against the bad row) are dropped; the rest of the
    game's regulation plays count (the game has no overtime).

wp_after (QA Q3): the offense's chance to win on the next nflverse row of the same game that has a
game clock, a later play_id and win chance (END GAME rows excluded), or the final result
(1 / 0 / 0.5 from the offense's side) when there is none. swing = wp_after - wp_before. This replaces
nflverse vegas_wpa, which is measured against the very next row even when that row is an
out-of-order, clock-less note (2019 Wk1 PIT at NE) or a stale value (2024 Wk19 WAS at TB).

desc (QA Q4): the games-v4 display_text for the play (read-only; frontend/public/data/games), so
reversed plays read as what counted, not the raw nflverse text.

Fan-facing fields carry no EPA, xpass, play ids or betting fields. "swing" is the change in the
offense's chance to win (0-1 scale; the UI shows x100 as "chance to win swung N points").

Frozen weeks: a week already in the committed swings.json must not change; the build exits 1
if it would (new data only adds weeks).

Frozen-week overrides: a reviewed JSON file (mining/frozen_overrides/*.json) lists weeks allowed to
change, with a reason; pass it with --allow-changes. Any changed week not listed still fails, and a
listed week that does not change fails too (the list must be exact).

Usage: python mining/build_swings.py PBP_PARQUET [PBP_PARQUET ...] [--out data/site/swings.json]
       [--games frontend/public/data/games] [--allow-changes mining/frozen_overrides/<file>.json]
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
           "vegas_wp", "vegas_wpa", "vegas_home_wp", "home_score", "away_score", "play_id"]
GAMES_DIR = ROOT / "frontend/public/data/games"


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
    if r.get("_bad_row") or qtr is None or not 1 <= qtr <= 4:
        return False
    if r.get("play_type") not in SWING_PLAY_TYPES or _num(r.get("qb_kneel")) or _num(r.get("qb_spike")):
        return False
    if r.get("play_type") == "field_goal" and (_num(r.get("kick_distance")) or 0) > MAX_FG:
        return False
    return _num(r.get("vegas_wp")) is not None and _num(r.get("_wp_after")) is not None and bool(r.get("posteam"))


def mark_bad_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Flag the bad 2019_03_CIN_BUF "End of half" row and the row right before it (nflverse order)."""
    out = [dict(r) for r in rows]
    for i, r in enumerate(out):
        if r.get("game_id") == BAD_GAME and (r.get("desc") or "").startswith("End of half"):
            r["_bad_row"] = True
            if i > 0 and out[i - 1].get("game_id") == BAD_GAME:
                out[i - 1]["_bad_row"] = True
    return out


def attach_after(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Set _wp_after (offense's side) per QA Q3: next later-play_id row with a clock and win chance, else final."""
    by_game: dict[str, list[int]] = {}
    for i, r in enumerate(rows):
        by_game.setdefault(r["game_id"], []).append(i)
    for idx in by_game.values():
        for k, i in enumerate(idx):
            r = rows[i]
            if not r.get("posteam") or _num(r.get("play_id")) is None:
                continue
            pid, home_post = float(r["play_id"]), None
            for j in idx[k + 1:]:
                n = rows[j]
                if (n.get("time") and _num(n.get("play_id")) is not None and float(n["play_id"]) > pid
                        and _num(n.get("vegas_home_wp")) is not None
                        and not (n.get("desc") or "").upper().startswith("END GAME")):
                    home_post = float(n["vegas_home_wp"])
                    break
            if home_post is None:
                hs, as_ = float(r["home_score"]), float(r["away_score"])
                home_post = 1.0 if hs > as_ else 0.0 if hs < as_ else 0.5
            r["_wp_after"] = home_post if r["posteam"] == r["home_team"] else 1.0 - home_post
    return rows


def week_key(r: dict[str, Any]) -> str:
    return f"{int(r['season'])}-w{int(r['week']):02d}"


def _round4(v: float) -> float:
    return round(v, 4)


def swing_record(r: dict[str, Any], post_rounds: dict[tuple[int, int], str]) -> dict[str, Any]:
    wp, after = float(r["vegas_wp"]), float(r["_wp_after"])
    season, week = int(r["season"]), int(r["week"])
    return {
        "season": season, "week": week, "round": post_rounds.get((season, week)),
        "game_id": r["game_id"], "home": r["home_team"], "away": r["away_team"],
        "home_score": int(r["home_score"]), "away_score": int(r["away_score"]),  # final score (nflverse)
        "team": r["posteam"],
        "qtr": int(r["qtr"]), "clock": r["time"],
        "down": None if _num(r.get("down")) is None else int(r["down"]),
        "togo": None if _num(r.get("ydstogo")) is None else int(r["ydstogo"]),
        "yardline_100": None if _num(r.get("yardline_100")) is None else int(r["yardline_100"]),
        "play_type": r["play_type"], "desc": r["_text"],
        "wp_before": _round4(wp), "wp_after": _round4(after), "swing": _round4(after - wp),
    }


def _rank_key(r: dict[str, Any]) -> tuple:
    # biggest |swing| first; deterministic tie-break on game and nflverse row order (play_id not exported)
    return (-abs(float(r["_wp_after"]) - float(r["vegas_wp"])), r["game_id"], float(r.get("play_id") or 0))


def post_round_map(rows: Iterable[dict[str, Any]]) -> dict[tuple[int, int], str]:
    weeks: dict[int, set[int]] = {}
    for r in rows:
        if r.get("season_type") == "POST":
            weeks.setdefault(int(r["season"]), set()).add(int(r["week"]))
    return {(s, w): ROUNDS[i] for s, ws in weeks.items() for i, w in enumerate(sorted(ws)) if i < len(ROUNDS)}


def display_texts(games_dir: Path):
    """Lazy (game_id, play_id) -> games-v4 display_text lookup; files are only read."""
    cache: dict[str, dict[int, str]] = {}

    def get(game_id: str, play_id: Any) -> str:
        if game_id not in cache:
            c = json.loads((games_dir / f"{game_id}.json").read_text())["cols"]
            cache[game_id] = {int(p): t for p, t in zip(c["play_id"], c["display_text"])}
        return cache[game_id][int(float(play_id))]

    return get


def build(rows: list[dict[str, Any]], text_of, top_n: int = TOP_N) -> dict[str, Any]:
    """text_of(game_id, play_id) -> fan display text (games-v4)."""
    rows = attach_after(mark_bad_rows(rows))
    rounds = post_round_map(rows)
    cands = sorted((r for r in rows if is_swing_candidate(r)), key=_rank_key)
    weeks: dict[str, dict[str, Any]] = {}
    picked = {}
    for r in cands:  # already ranked
        picked.setdefault(week_key(r), r)
    for r in [*picked.values(), *cands[:top_n]]:
        r["_text"] = text_of(r["game_id"], r["play_id"])
    for k, r in picked.items():
        weeks[k] = swing_record(r, rounds)
    seasons = sorted({int(r["season"]) for r in rows})
    return {
        "v": SCHEMA_VERSION,
        "source": f"nflverse play-by-play {seasons[0]}-{seasons[-1]}" if seasons else "nflverse play-by-play",
        "win_chance": "nflverse win chance (adjusted for pregame expectations); regulation only",
        "filter": "regulation run/pass/field goal/punt; no kneels, spikes, overtime or field goals over 64 yd",
        "weeks": dict(sorted(weeks.items())),
        "top": [swing_record(r, rounds) for r in cands[:top_n]],
    }


IDENTITY_KEYS = ("season", "week", "game_id", "team", "qtr", "clock", "down", "togo", "yardline_100", "play_type")
VALUE_KEYS = ("wp_before", "wp_after", "swing")


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any], allowed: Iterable[str] = (),
                 text_fields: Iterable[str] = ()) -> list[str]:
    """Problems with published weeks.

    `allowed` weeks may change anything (and must change their play or value).
    Every other week may change only `text_fields`; its play identity and wp_before/wp_after/swing must be identical.
    """
    if not old:
        return []
    allowed, text_fields = set(allowed), set(text_fields)
    probs = []
    for k, v in sorted(old.get("weeks", {}).items()):
        n = new["weeks"].get(k)
        if n is None:
            probs.append(f"{k} missing")
            continue
        play_changed = any(v.get(f) != n.get(f) for f in IDENTITY_KEYS + VALUE_KEYS)
        if k in allowed:
            if not play_changed:
                probs.append(f"{k} in override but play/value unchanged")
            continue
        if play_changed:
            probs.append(f"{k} play/value changed (not in override)")
        elif any(v.get(f) != n.get(f) for f in set(v) | set(n) if f not in text_fields):
            probs.append(f"{k} changed (not in override)")
    return probs


def load_override(path: str | None) -> tuple[set[str], set[str]]:
    if not path:
        return set(), set()
    o = json.loads(Path(path).read_text())
    if not o.get("reason") or not o.get("reviewed_in") or not isinstance(o.get("weeks"), list):
        raise SystemExit(f"override {path} needs reason, reviewed_in and a weeks list")
    return set(o["weeks"]), set(o.get("text_fields_all_weeks", []))


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd

    rows: list[dict[str, Any]] = []
    for p in paths:  # one season at a time keeps memory low
        df = pd.read_parquet(p, columns=COLUMNS)
        df = df.astype(object).where(df.notna(), None)
        rows.extend(df.to_dict("records"))
        del df
    return rows


def dumps(obj: dict[str, Any]) -> str:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("pbp", nargs="+")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--games", default=str(GAMES_DIR))
    ap.add_argument("--allow-changes", default=None)
    a = ap.parse_args(argv)
    out = Path(a.out)
    new = build(load_rows(a.pbp), display_texts(Path(a.games)))
    old = json.loads(out.read_text()) if out.exists() else None
    problems = check_frozen(old, new, *load_override(a.allow_changes))
    if problems:
        print("FAIL: published weeks: " + "; ".join(problems), file=sys.stderr)
        return 1
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(dumps(new))
    print(f"wrote {out} ({out.stat().st_size} bytes, {len(new['weeks'])} weeks, top {len(new['top'])})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
