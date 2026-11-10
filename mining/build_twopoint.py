"""Build data/site/twopoint.json for B1 concept 1 ("Kick or go for two?" card, NFL Product UI).

Source: nflverse play-by-play 2019-2025 (REG + POST). Shown values are real nflverse rates only
(concept 1: no engine values):
  * two-point tries: two_point_attempt == 1 -> 960 tries, 456 success (47.5%); run 266, pass 681,
    13 "no_play" rows that still carry a result (counted in the overall rate only);
  * extra points: play_type == "extra_point", extra_point_result == "good" -> 9,119 tries.
Per-try rows ("tries") cover every try the headline counts, overtime included (one rule: 960 rows =
two_point.tries); overtime tries never carry win chance (per_choice_win_chance is null for qtr > 4). "kicks" are real extra points in
the same row shape, chosen by a full filter (no sampling): Q4, 5:00 or less left, margin before the try
within 8. #207 removed wp at Analyte's earlier no-win-chance request; HGIC asked for it back (2026-11-03,
append-only): wp_before / wp_after at the end of cols, for tries and kicks. wp_before = nflverse vegas_wp at the
try snap (the trying/kicking team = "team" = posteam). wp_after = the same team's nflverse vegas win chance on the
next later-play_id row of the game with a clock and win chance (not END GAME), else the final result (1/0/0.5):
the swings wp_after rule (mining/build_swings.py attach_after). Overtime (qtr > 4): both null. Concept 2 (behind CHECKER_ENABLED=false): per-choice
win chance (go for 2 vs kick the PAT) for each try is filled by ``--fill-win-chance`` from the 4th-down
engine (see ``fill_win_chance``); overtime and late-Q4 (0:01-2:00) tries stay null.
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
           "pass_attempt", "two_point_attempt", "two_point_conv_result", "extra_point_result", "score_differential", "vegas_wp",
           "vegas_home_wp", "home_team", "home_score", "away_score", "play_id", "desc"]
BASE_COLS = ["season", "week", "season_type", "game_id", "team", "opp", "qtr", "clock", "diff", "kind", "made"]
WP_COLS = ["wp_before", "wp_after"]  # appended 2026-11-03 (HGIC), see module docstring
COLS = BASE_COLS + WP_COLS
KICK_MAX_DIFF = 8     # margin before the try within one score
KICK_MAX_CLOCK = 300  # seconds left in Q4 (5:00 or less)
SUMMARY = ("two_point", "extra_point")
OVERRIDE = ROOT / "mining/frozen_overrides/twopoint-2026-11-03-noplay-kind.json"


def try_kind(r: dict[str, Any]) -> str:
    """run or pass. nflverse marks 13 real tries play_type "no_play" (a penalty enforced between downs);
    their nflverse pass_attempt flag says which they were (1 -> pass, else run)."""
    pt = r.get("play_type")
    if pt in ("run", "pass"):
        return pt
    return "pass" if _num(r.get("pass_attempt")) == 1 else "run"


def _num(v: Any) -> float | None:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(f) else f


def _r4(v: Any) -> float | None:
    v = _num(v)
    return None if v is None else round(v, 4)


def wp_pair(r: dict[str, Any]) -> list[float | None]:
    """[wp_before, wp_after] from the trying team's view; null in overtime."""
    if int(r["qtr"]) > 4:
        return [None, None]
    return [_r4(r.get("vegas_wp")), _r4(r.get("_wp_after"))]


def attach_after(rows: list[dict[str, Any]], want: Callable[[dict[str, Any]], bool]) -> None:
    """Set _wp_after on ``want`` rows (posteam's side): the swings wp_after rule (build_swings.attach_after)."""
    by_game: dict[str, list[dict[str, Any]]] = {}
    for r in rows:
        if _num(r.get("play_id")) is not None:
            by_game.setdefault(r["game_id"], []).append(r)
    for g in by_game.values():
        g.sort(key=lambda r: float(r["play_id"]))
        for k, r in enumerate(g):
            if not want(r) or not r.get("posteam"):
                continue
            home_post = None
            for n in g[k + 1:]:
                if (n.get("time") and _num(n.get("vegas_home_wp")) is not None
                        and not (n.get("desc") or "").upper().startswith("END GAME")):
                    home_post = float(n["vegas_home_wp"])
                    break
            if home_post is None:
                hs, as_ = float(r["home_score"]), float(r["away_score"])
                home_post = 1.0 if hs > as_ else 0.0 if hs < as_ else 0.5
            r["_wp_after"] = home_post if r["posteam"] == r["home_team"] else 1.0 - home_post


def _rate(made: int, tries: int) -> dict[str, Any]:
    return {"tries": tries, "made": made, "rate": round(made / tries, 4) if tries else 0.0}


def build(rows: list[dict[str, Any]]) -> dict[str, Any]:
    tries = [r for r in rows if _num(r.get("two_point_attempt")) == 1]
    xps = [r for r in rows if r.get("play_type") == "extra_point"]
    ok = lambda r: r.get("two_point_conv_result") == "success"  # noqa: E731
    by = lambda k: [r for r in tries if try_kind(r) == k]  # noqa: E731
    def row(r, kind, made):
        return [int(r["season"]), int(r["week"]), r["season_type"], r["game_id"], r["posteam"], r["defteam"],
                int(r["qtr"]), r["time"], int(r["score_differential"]), kind, int(made), *wp_pair(r)]

    order = lambda s: (s[0], s[1], s[3], s[6], [-int(x) for x in s[7].split(":")])  # noqa: E731
    situ = sorted((row(r, try_kind(r), ok(r)) for r in tries), key=order)
    kicks = sorted((row(r, "extra_point", r.get("extra_point_result") == "good") for r in xps if is_close_late_kick(r)),
                   key=order)
    return {
        "schema_version": 2,
        "source": "nflverse play-by-play via mining/build_twopoint.py",
        "season_list": sorted({int(r["season"]) for r in rows}),
        "kick_rule": f"Q4, {KICK_MAX_CLOCK // 60}:00 or less left, margin before the try within "
                     f"{KICK_MAX_DIFF} points (every such nflverse extra point, no sampling)",
        "two_point": {**_rate(sum(map(ok, tries)), len(tries)),
                      "run": _rate(sum(map(ok, by("run"))), len(by("run"))),
                      "pass": _rate(sum(map(ok, by("pass"))), len(by("pass")))},
        "extra_point": _rate(sum(r.get("extra_point_result") == "good" for r in xps), len(xps)),
        "per_choice_win_chance": None,
        "cols": COLS,
        "tries": situ,
        "kicks": kicks,
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


def is_close_late_kick(r: dict[str, Any]) -> bool:
    if _num(r.get("qtr")) != 4 or _num(r.get("score_differential")) is None:
        return False
    m, sec = (int(x) for x in r["time"].split(":"))
    return 60 * m + sec <= KICK_MAX_CLOCK and abs(_num(r["score_differential"])) <= KICK_MAX_DIFF


def key(r: dict[str, Any]) -> tuple:
    return (r["game_id"], r["qtr"], r["clock"], r["team"])


def kick_key(r: dict[str, Any]) -> tuple:
    """Kicks need ``made`` too: 2020_12_CAR_MIN has two MIN extra points at Q4 00:46 (a blocked one wiped
    out by an offside penalty, then the good re-kick), which collided under ``key``."""
    return (*key(r), r["made"])


def carry_win_chance(old: dict[str, Any] | None, new: dict[str, Any]) -> None:
    """Keep the published per-choice win chance; tries without an entry (overtime) get null, never a value."""
    w = (old or {}).get("per_choice_win_chance")
    if not w:
        return
    by = dict(w["by_try"])
    for r in new["tries"]:
        t = dict(zip(new["cols"], r))
        by.setdefault(wc_key(t), None)
        assert int(t["qtr"]) <= 4 or by[wc_key(t)] is None
    new["per_choice_win_chance"] = {**w, "by_try": by}




def load_override() -> set[str]:
    return set(json.loads(OVERRIDE.read_text())["tries"]) if OVERRIDE.exists() else set()


WP_OVERRIDE = ROOT / "mining/frozen_overrides/twopoint-2026-11-03-wp-append.json"


def wp_append_ok(old: dict[str, Any] | None, new: dict[str, Any]) -> bool:
    """Override (narrow, append-only): new cols are exactly old cols + WP_COLS."""
    return bool(old) and WP_OVERRIDE.exists() and old["cols"] == BASE_COLS and new["cols"] == BASE_COLS + WP_COLS


def strip_wp(doc: dict[str, Any]) -> dict[str, Any]:
    n = len(BASE_COLS)
    return {**doc, "cols": doc["cols"][:n], "tries": [r[:n] for r in doc["tries"]], "kicks": [r[:n] for r in doc["kicks"]]}


def check_frozen(old, new, allowed: set[str] | None = None):
    """With the wp-append override, old rows are compared against new rows minus the appended wp columns,
    so every existing value must stay identical.
    Override (narrow): the listed tries may change only kind no_play -> run/pass, and only the run/pass
    sub-totals may move; two_point tries/made/rate and extra_point stay frozen."""
    allowed = load_override() if allowed is None else allowed
    if wp_append_ok(old, new):
        new = strip_wp(new)
    if old and allowed:
        ci = old["cols"].index("kind")
        nk = {key(dict(zip(new["cols"], r))): r for r in new["tries"]}
        fixed = []
        for r in old["tries"]:
            k = key(dict(zip(old["cols"], r)))
            if "|".join(map(str, k)) in allowed and r[ci] == "no_play":
                n = nk.get(k)
                if n is None or n[:ci] + n[ci + 1:] != r[:ci] + r[ci + 1:] or n[ci] not in ("run", "pass"):
                    return [f"override {k}: only kind no_play -> run/pass may change"]
                r = n
            fixed.append(r)
        tp = lambda d: {k: v for k, v in d["two_point"].items() if k not in ("run", "pass")}  # noqa: E731
        if tp(old) != tp(new):
            return ["summary two_point"]
        old = {**old, "tries": fixed, "two_point": new["two_point"]}
    return _check(old, new, key, "tries", SUMMARY) + _check(old, new, kick_key, "kicks")


def load_rows(paths: list[str]) -> list[dict[str, Any]]:
    import pandas as pd
    df = pd.concat([pd.read_parquet(p, columns=COLUMNS) for p in paths], ignore_index=True)
    rows = json.loads(df.to_json(orient="records"))
    is_try = lambda r: r.get("two_point_attempt") == 1 or r.get("play_type") == "extra_point"  # noqa: E731
    attach_after(rows, is_try)
    return [r for r in rows if is_try(r)]


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
        before = json.loads(json.dumps({k: v for k, v in doc.items() if k != "per_choice_win_chance"}))
        doc["per_choice_win_chance"] = engine_win_chance(doc)
        # only per_choice_win_chance may change (tries, kicks, cols and summaries are byte-identical)
        assert {k: v for k, v in doc.items() if k != "per_choice_win_chance"} == before
        out.write_text(json.dumps(doc, separators=(",", ":"), ensure_ascii=False) + "\n")
        vals = doc["per_choice_win_chance"]["by_try"].values()
        print(f"filled {sum(v is not None for v in vals)}, null {sum(v is None for v in vals)}")
        return 0
    if not a.pbp:
        ap.error("PBP_PARQUET required")
    new = build(load_rows(a.pbp))
    old = json.loads(out.read_text()) if out.exists() else None
    carry_win_chance(old, new)
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
