"""coaches/{season}.json: each head coach's 4th-down calls vs the shared engine.

A call *qualifies* when the engine's best option beats the next by ≥2 win-chance
points (not a close call). Coaches with fewer than MIN_CALLS_FOR_GRADE qualifying
calls are `gradeable: false` ("Not enough calls"). `grade` stays null until the
calibrated WP model (#37) lands; Phase 4 fills it.

Per-call win chance (offense perspective, 0–1; added for #59, all fields additive):
  wp_before            nflverse pre-snap wp (same for every option)
  wp_after_chosen      engine expected wp after the option the coach chose
  wp_after_best        engine expected wp after the engine's best option
  wp_after_actual      nflverse wp after the real play (wp + wpa); null if missing
  decision_value_pts   +gap_pts when the coach chose the best option, else −wp_cost_pts
  outcome_vs_expected_pts  (wp_after_actual − wp_after_chosen) × 100: beat (+) or fell short (−)
  net_value_pts        decision_value_pts + outcome_vs_expected_pts (signed)
  alt_cost_pts         (wp[chosen] − max wp[other options]) × 100: + when the call beat the best
                       alternative (= gap_pts when the coach agreed), − when it missed (= −wp_cost_pts)
v1.2: records carry no play_id (house rule); they are keyed by game_id + qtr + clock ("M:SS").
`best` ranks qualifying calls by alt_cost_pts (cost avoided). Every call, compact, is in
coaches/calls/{season}.json. Regulation only (qtr ≤ 4). Built from a frozen input; see OVERRIDE below.
Per coach-season: games, net_value_pts / decision_value_pts / outcome_vs_expected_pts (sums
over qualifying calls), alongside the existing cost totals (net_wp_pts = −Σ wp_cost_pts,
wp_cost_pts_total).

    python -m nfl_sim.products.coaches
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pandas as pd

from nfl_sim.products.meta import PRODUCTS_DIR, write_json

SEASONS = tuple(range(2019, 2026))
FROZEN_DIR = Path(__file__).resolve().parent / "frozen"
FROZEN_INPUT = FROZEN_DIR / "coaches_input_2026-10-26.parquet"
FROZEN_META = FROZEN_DIR / "coaches_input_2026-10-26.json"
# The published coaches files are valued by the Oct 26 engine, not main's current engine.
ENGINE_VERSION = "fourth_down_engine.v1"

MIN_CALLS_FOR_GRADE = 20
TOP_N = 5

# OVERRIDE (pinned 2026-11-03, Head Grokka in Charge, option 1): the published coaches
# files (#170) were built when the engine offered a punt only from yardline_100 >= 36; the
# shared engine now offers it from >= 35. To keep every published coaches value unchanged,
# the coaches build reads a FROZEN input table (frozen/coaches_input_2026-10-26.parquet):
# the 2026-10-26 fourth_down_engine.v1 table with plays on the 35 re-scored at this cutoff,
# plus nflverse wpa. It does not use main's live engine. Moving coaches to the current
# engine is a separate, approved republish.
COACHES_PUNT_MIN_YARDLINE_100 = 36


def frozen_meta() -> dict:
    return json.loads(FROZEN_META.read_text())


def load_frozen() -> pd.DataFrame:
    """Frozen input, sha256-checked against its sidecar, with the engine result rebuilt as JSON."""
    meta = frozen_meta()
    sha = hashlib.sha256(FROZEN_INPUT.read_bytes()).hexdigest()
    if sha != meta["input_sha256"]:
        raise ValueError(f"frozen coaches input sha256 {sha} != {meta['input_sha256']}")
    t = pd.read_parquet(FROZEN_INPUT)

    def eng(r):
        wp = {o: r[f"wp_{o}"] for o in ("go", "fg", "punt") if not pd.isna(r[f"wp_{o}"])}
        return json.dumps({"recommendation": r["rec"], "close_call": bool(r["close_call"]),
                           "gap_pts": r["gap_pts"], "wp": wp})
    t["engine"] = [eng(r) for r in t.to_dict("records")]
    return t.drop(columns=["rec", "close_call", "gap_pts", "wp_go", "wp_fg", "wp_punt"])


def _clock(r) -> str:
    """Game clock at the snap, "M:SS" left in the quarter (records are keyed by game_id + qtr + clock)."""
    s = int(r["quarter_seconds_remaining"])
    return f"{s // 60}:{s % 60:02d}"


def _play(r) -> dict:
    # No play_id in published files (house rule); key = game_id + qtr + clock.
    return {"game_id": r["game_id"], "qtr": int(r["qtr"]), "clock": _clock(r), "week": int(r["week"]),
            "opponent": r["defteam"], "ydstogo": int(r["ydstogo"]),
            "yardline_100": int(r["yardline_100"]), "score_differential": int(r["score_differential"]),
            "actual": r["actual"], "recommendation": r["rec"], "wp_cost_pts": round(r["cost"], 2),
            "result": r["result"], "desc": r["desc"],
            "wp_before": _r4(r.get("wp")), "wp_after_chosen": _r4(r.get("wp_chosen")),
            "wp_after_best": _r4(r.get("wp_best")), "wp_after_actual": _r4(r.get("wp_after_actual")),
            "decision_value_pts": round(r["decision_value"], 2),
            "outcome_vs_expected_pts": _r2(r.get("outcome_vs_expected")),
            "net_value_pts": round(r["net_value"], 2),
            "alt_cost_pts": round(r["alt_cost"], 2)}


def _call(r) -> dict:
    """Compact per-call record for coaches/calls/{season}.json (every call, qualifying or not)."""
    return {"game_id": r["game_id"], "qtr": int(r["qtr"]), "clock": _clock(r), "coach": r["coach"],
            "team": r["posteam"], "actual": r["actual"], "recommendation": r["rec"],
            "qualifying": bool(r["qualifying"]), "wp_cost_pts": round(r["cost"], 2),
            "alt_cost_pts": round(r["alt_cost"], 2)}


def _ok(x) -> bool:
    return x is not None and not pd.isna(x)


def _r4(x):
    return round(float(x), 4) if _ok(x) else None


def _r2(x):
    return round(float(x), 2) if _ok(x) else None


def calls_frame(table: pd.DataFrame) -> pd.DataFrame:
    t = table.copy()
    eng = t["engine"].map(json.loads)
    t["rec"] = eng.map(lambda e: e["recommendation"])
    t["close"] = eng.map(lambda e: e["close_call"])
    t["gap"] = eng.map(lambda e: e["gap_pts"])
    # win-chance points lost vs the engine's best option (0 when the coach agreed)
    t["cost"] = [(e["wp"][e["recommendation"]] - e["wp"][a]) * 100 if a in e["wp"] else None
                 for e, a in zip(eng, t["actual"])]
    t = t[t["cost"].notna()].copy()
    eng = eng[t.index]
    # win-chance points the coach's call beat (+) or trailed (−) the best other option by
    t["alt_cost"] = [(e["wp"][a] - max(v for o, v in e["wp"].items() if o != a)) * 100
                     for e, a in zip(eng, t["actual"])]
    t["wp_chosen"] = [e["wp"][a] for e, a in zip(eng, t["actual"])]
    t["wp_best"] = eng.map(lambda e: e["wp"][e["recommendation"]])
    if "wp" not in t:
        t["wp"] = None
    if "wpa" in t:
        t["wp_after_actual"] = pd.to_numeric(t["wp"], errors="coerce") + pd.to_numeric(t["wpa"], errors="coerce")
    else:
        t["wp_after_actual"] = None
    agreed = t["actual"] == t["rec"]
    t["decision_value"] = t["gap"].where(agreed, -t["cost"]).astype(float)
    t["outcome_vs_expected"] = (pd.to_numeric(t["wp_after_actual"], errors="coerce") - t["wp_chosen"]) * 100
    t["net_value"] = t["decision_value"] + t["outcome_vs_expected"].fillna(0.0)
    t["coach"] = t["home_coach"].where(t["is_home_possession"], t["away_coach"])
    t["qualifying"] = ~t["close"]
    return t


def coach_rows(t: pd.DataFrame) -> list[dict]:
    out = []
    for (coach, team), g in t.groupby(["coach", "posteam"]):
        q = g[g["qualifying"]]
        should_go = q[q["rec"] == "go"]
        should_kick = q[q["rec"] != "go"]
        ranked = q.sort_values(["cost", "game_id", "play_id"])
        out.append({
            "coach": coach, "team": team, "calls": len(g), "qualifying_calls": len(q),
            "agreed": int((q["actual"] == q["rec"]).sum()),
            "should_go": len(should_go),
            "went_when_should_go": int((should_go["actual"] == "go").sum()),
            "kicked_when_should_go": int((should_go["actual"] != "go").sum()),
            "went_when_should_kick": int((should_kick["actual"] == "go").sum()),
            "go_rate": round(float((g["actual"] == "go").mean()), 4),
            "games": int(g["game_id"].nunique()),
            "net_wp_pts": round(-float(q["cost"].sum()), 2),
            "wp_cost_pts_total": round(float(q["cost"].sum()), 2),
            "decision_value_pts": round(float(q["decision_value"].sum()), 2),
            "outcome_vs_expected_pts": round(float(q["outcome_vs_expected"].fillna(0).sum()), 2),
            "net_value_pts": round(float(q["net_value"].sum()), 2),
            "min_calls_for_grade": MIN_CALLS_FOR_GRADE,
            "gradeable": len(q) >= MIN_CALLS_FOR_GRADE,
            "grade": None,
            # best: most win chance gained over the best alternative (cost avoided); worst: biggest cost
            "best": [_play(r) for r in q[q["alt_cost"] > 0].sort_values(["alt_cost", "game_id", "play_id"],
                                                                         ascending=[False, True, True]).head(TOP_N).to_dict("records")],
            "worst": [_play(r) for r in ranked[ranked["cost"] > 0].tail(TOP_N).iloc[::-1].to_dict("records")],
        })
    return sorted(out, key=lambda r: (r["team"], r["coach"]))


def season_docs(t: pd.DataFrame, season: int, meta: dict) -> tuple[dict, dict]:
    prov = meta["provenance_by_season"][str(season)]
    s = t[t["season"] == season]
    doc = {
        "schema_version": "coaches.v1.2", "engine_version": ENGINE_VERSION,
        "provenance": prov, "season": season,
        "qualifying_rule": "engine gap ≥ 2 win-chance points (not a close call)",
        "min_calls_for_grade": MIN_CALLS_FOR_GRADE,
        "grade_status": "null until calibrated WP (#37); Phase 4 grades gradeable coaches only",
        "coaches": coach_rows(s),
    }
    calls = {
        "schema_version": "coaches_calls.v1", "engine_version": ENGINE_VERSION,
        "provenance": prov, "season": season,
        "calls": [_call(r) for r in s.sort_values(["game_id", "play_id"]).to_dict("records")],
    }
    return doc, calls


def build() -> dict[int, int]:
    meta = frozen_meta()
    t = calls_frame(load_frozen())
    counts = {}
    for season in SEASONS:
        doc, calls = season_docs(t, season, meta)
        write_json(f"coaches/{season}.json", doc)
        write_json(f"coaches/calls/{season}.json", calls)
        counts[season] = len(doc["coaches"])
    return counts


if __name__ == "__main__":
    print(build())
