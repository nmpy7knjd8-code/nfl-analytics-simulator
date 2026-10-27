"""Plain-language fields for one real 4th-down play (fan-facing; win chance only, no spread/odds).

    fourth_down_text(row) -> {"coach_call", "what_happened", "best_call", "edge_pts"}

``row`` is a fourth_downs table row (needs posteam, ydstogo, yardline_100, actual, result, engine).
"""
from __future__ import annotations

import json
from typing import Any

VERB = {"go": "went for it", "fg": "kicked a field goal", "punt": "punted"}
CALL = {"go": "going for it", "fg": "kicking the field goal", "punt": "punting"}
HAPPENED = {
    "touchdown": "They scored a touchdown.", "converted": "They picked up the first down.",
    "failed": "They came up short and turned it over on downs.", "turnover": "They turned the ball over.",
    "fg_made": "The kick was good.", "fg_missed": "The kick missed.", "fg_blocked": "The kick was blocked.",
    "fg_other": "The kick did not count.", "punt": "They punted it away.", "punt_blocked": "The punt was blocked.",
}


def _spot(yl: int) -> str:
    return "midfield" if yl == 50 else (f"the opponent's {yl}" if yl < 50 else f"their own {100 - yl}")


def fourth_down_text(row: dict[str, Any]) -> dict[str, Any]:
    e = row["engine"] if isinstance(row["engine"], dict) else json.loads(row["engine"])
    team, yl, dist, did = row["posteam"], int(row["yardline_100"]), int(row["ydstogo"]), row["actual"]
    best, wp = e["recommendation"], e["wp"]
    ranked = sorted(wp, key=lambda o: -wp[o])
    edge = round((wp[best] - wp[ranked[1]]) * 100, 1) if len(ranked) > 1 else None
    togo = "goal" if dist >= yl else str(dist)
    coach = f"On 4th and {togo} at {_spot(yl)}, {team} {VERB[did]}."
    if edge is None:
        best_txt = f"Best call: {CALL[best]}, the only real option."
    elif edge < 0.5:
        best_txt = "Too close to call: the options were within half a point of win chance."
    elif edge < 1.0:
        best_txt = f"Toss-up: {CALL[best]} was barely better, by {edge} points of win chance."
    else:
        best_txt = f"Best call: {CALL[best]}, worth {edge} more points of win chance than {CALL[ranked[1]]}."
    cost = round((wp[best] - wp[did]) * 100, 1) if did in wp else None
    if did == best and edge is not None and edge >= 0.5:
        best_txt += " The coach made the right call."
    elif cost is not None and cost >= 0.5:
        best_txt += f" {CALL[did].capitalize()} cost {cost} points."
    return {"coach_call": coach, "what_happened": HAPPENED.get(row["result"], ""), "best_call": best_txt,
            "edge_pts": edge}
