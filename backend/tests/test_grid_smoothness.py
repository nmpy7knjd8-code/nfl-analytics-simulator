"""H8: the committed checker grid must give stable advice up the field.

Along a row (fixed time, score and distance; yard line 1..99) the best option may change
at most twice. Flat punt bands used to flip the advice back and forth (4th & 1 tied:
go, punt, go, punt).

A change only counts when the new option beats the one currently shown by more than
TIE_PTS. Inside that band the two are a dead heat (the UI calls anything under 2 pts a
close call), and counting 0.1-pt wobbles would just test rounding.
"""
from __future__ import annotations

import json

from nfl_sim.products import grid as g
from nfl_sim.products.meta import PRODUCTS_DIR

MAX_BEST_CHANGES_PER_ROW = 2
TIE_PTS = 0.25
GO, FG, PUNT = 0, 1, 2
# FG joins once its make rate is smooth by distance (M12); until then go vs punt only.
CHECKED_OPTIONS = (GO, PUNT)


def _rows():
    doc = json.loads((PRODUCTS_DIR / "fourth_down" / "grid.json").read_text())
    scale = doc["scale"]
    for t in range(len(g.TIMES)):
        for s in range(len(g.SCORE)):
            for d in range(len(g.DIST)):
                row = [doc["cells"][g.cell_index(t, s, d, yl)] for yl in range(1, 100)]
                yield (t, s, d), [c for c in row if c is not None], scale


def best_changes(row, scale, options=CHECKED_OPTIONS, tie_pts=TIE_PTS) -> int:
    cur, n = None, 0
    for c in row:
        vals = {i: c[i] for i in options if c[i] is not None}
        if not vals:
            continue
        top = max(vals, key=vals.get)
        if cur is None:
            cur = top
        elif cur not in vals or (top != cur and vals[top] - vals[cur] > tie_pts / 100 * scale):
            n += top != cur
            cur = top
    return n


def test_best_choice_changes_at_most_twice_per_row():
    bad = [(k, n) for k, row, sc in _rows() if (n := best_changes(row, sc)) > MAX_BEST_CHANGES_PER_ROW]
    assert not bad, f"{len(bad)} rows change best option > {MAX_BEST_CHANGES_PER_ROW}x: {bad[:10]}"


def test_counter_sees_the_old_flip_pattern():
    # go, punt, go, punt (the QA example) is 3 changes and must fail.
    row = [[5000, None, 4000], [4000, None, 5000], [5000, None, 4000], [4000, None, 5000]]
    assert best_changes(row, 10000) == 3
    # a 0.1-pt wobble is a tie, not a change
    assert best_changes([[5000, None, 4990], [4990, None, 5000]], 10000) == 0
