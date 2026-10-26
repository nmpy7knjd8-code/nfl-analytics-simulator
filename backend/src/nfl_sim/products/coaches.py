"""coaches/{season}.json: each head coach's 4th-down calls vs the shared engine.

A call *qualifies* when the engine's best option beats the next by ≥2 win-chance
points (not a close call). Coaches with fewer than MIN_CALLS_FOR_GRADE qualifying
calls are `gradeable: false` ("Not enough calls"). `grade` stays null until the
calibrated WP model (#37) lands; Phase 4 fills it.

    python -m nfl_sim.products.coaches
"""
from __future__ import annotations

import json

import pandas as pd

from nfl_sim.products import fourth_downs
from nfl_sim.products.engine import ENGINE_VERSION
from nfl_sim.products.meta import provenance, write_json

MIN_CALLS_FOR_GRADE = 20
TOP_N = 5


def _play(r) -> dict:
    return {"game_id": r["game_id"], "play_id": int(r["play_id"]), "week": int(r["week"]),
            "opponent": r["defteam"], "qtr": int(r["qtr"]), "ydstogo": int(r["ydstogo"]),
            "yardline_100": int(r["yardline_100"]), "score_differential": int(r["score_differential"]),
            "actual": r["actual"], "recommendation": r["rec"], "wp_cost_pts": round(r["cost"], 2),
            "result": r["result"], "desc": r["desc"]}


def calls_frame(table: pd.DataFrame) -> pd.DataFrame:
    t = table.copy()
    eng = t["engine"].map(json.loads)
    t["rec"] = eng.map(lambda e: e["recommendation"])
    t["close"] = eng.map(lambda e: e["close_call"])
    t["gap"] = eng.map(lambda e: e["gap_pts"])
    # win-chance points lost vs the engine's best option (0 when the coach agreed)
    t["cost"] = [(e["wp"][e["recommendation"]] - e["wp"][a]) * 100 if a in e["wp"] else None
                 for e, a in zip(eng, t["actual"])]
    t = t[t["cost"].notna()]
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
            "net_wp_pts": round(-float(q["cost"].sum()), 2),
            "min_calls_for_grade": MIN_CALLS_FOR_GRADE,
            "gradeable": len(q) >= MIN_CALLS_FOR_GRADE,
            "grade": None,
            # best: agreed with the engine where the margin was largest; worst: biggest win-chance cost
            "best": [_play(r) for r in q[q["cost"] == 0].sort_values(["gap", "game_id", "play_id"],
                                                                      ascending=[False, True, True]).head(TOP_N).to_dict("records")],
            "worst": [_play(r) for r in ranked[ranked["cost"] > 0].tail(TOP_N).iloc[::-1].to_dict("records")],
        })
    return sorted(out, key=lambda r: (r["team"], r["coach"]))


def build() -> dict[int, int]:
    t = calls_frame(fourth_downs.load())
    counts = {}
    for season in fourth_downs.SEASONS:
        rows = coach_rows(t[t["season"] == season])
        write_json(f"coaches/{season}.json", {
            "schema_version": "coaches.v1", "engine_version": ENGINE_VERSION,
            "provenance": provenance([season]), "season": season,
            "qualifying_rule": "engine gap ≥ 2 win-chance points (not a close call)",
            "min_calls_for_grade": MIN_CALLS_FOR_GRADE,
            "grade_status": "null until calibrated WP (#37); Phase 4 grades gradeable coaches only",
            "coaches": rows,
        })
        counts[season] = len(rows)
    return counts


if __name__ == "__main__":
    print(build())
