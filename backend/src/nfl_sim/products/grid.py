"""fourth_down/grid.json — the checker's lookup table, every cell from FourthDownEngine.evaluate.

Layout is a dense array so the file stays small: cell index =
((((t * len(SCORE)) + s) * len(DIST)) + d) * 99 + (yardline_100 - 1).
Each cell = [go, fg, punt] possession-team win chance ×10000 (null = option unavailable),
or null when the situation is impossible (distance > yardline_100).
Timeouts fixed at 3–3 and the offense is the home team (the checker flips for away).
"""
from __future__ import annotations

import sys
from multiprocessing import Pool

from nfl_sim.products.engine import (
    CLOSE_CALL_PTS,
    ENGINE_VERSION,
    EngineInput,
    load_engine,
)

DIST = (1, 2, 3, 4, 5, 6, 8, 10, 15)
SCORE = (-14, -10, -7, -4, -3, -1, 0, 1, 3, 4, 7, 10, 14)
TIMES = ((1, 450), (2, 450), (2, 120), (3, 450), (4, 600), (4, 300), (4, 120), (4, 60))
GRID_SEASON = 2023
_ENGINE = None


def grid_input(t: int, s: int, d: int, yl: int) -> EngineInput | None:
    qtr, qs = TIMES[t]
    if DIST[d] > yl:
        return None
    return EngineInput(yardline_100=yl, distance=DIST[d], score_differential=SCORE[s], qtr=qtr,
                       quarter_seconds_remaining=qs, season=GRID_SEASON)


def _init():
    global _ENGINE
    _ENGINE = load_engine()


def cell(x: EngineInput | None):
    if x is None:
        return None
    out = _ENGINE.evaluate(x)
    return [round(out.wp[o] * 10000) if o in out.wp else None for o in ("go", "fg", "punt")]


def cell_index(t: int, s: int, d: int, yl: int) -> int:
    """Flat index into ``cells``: ((t*len(SCORE)+s)*len(DIST)+d)*99 + (yl-1)."""
    return ((t * len(SCORE) + s) * len(DIST) + d) * 99 + (yl - 1)


def all_inputs():
    for t in range(len(TIMES)):
        for s in range(len(SCORE)):
            for d in range(len(DIST)):
                for yl in range(1, 100):
                    yield grid_input(t, s, d, yl)


def build(procs: int = 8) -> dict:
    from nfl_sim.products.meta import provenance

    with Pool(procs, initializer=_init) as pool:
        cells = pool.map(cell, list(all_inputs()), chunksize=256)
    return {
        "schema_version": "fourth_down_grid.v1",
        "engine_version": ENGINE_VERSION,
        "provenance": provenance(range(2019, 2022), extra={"note": "engine empirics fit on 2019–2021"}),
        "axes": {
            "time": [{"qtr": q, "quarter_seconds_remaining": s} for q, s in TIMES],
            "score_differential": list(SCORE),
            "distance": list(DIST),
            "yardline_100": [1, 99],
        },
        "fixed": {"posteam_timeouts": 3, "defteam_timeouts": 3, "is_home_possession": True, "season": GRID_SEASON},
        "scale": 10000,
        "close_call_pts": CLOSE_CALL_PTS,
        "options": ["go", "fg", "punt"],
        "index": "((time*len(score)+score)*len(distance)+distance)*99 + (yardline_100-1)",
        "cells": cells,
    }


if __name__ == "__main__":
    from nfl_sim.products.meta import write_json

    write_json("fourth_down/grid.json", build(int(sys.argv[1]) if len(sys.argv) > 1 else 8))
    print("wrote fourth_down/grid.json")
