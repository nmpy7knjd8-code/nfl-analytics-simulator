"""H8/M12: the committed checker grid must give stable advice up the field.

Along a row (fixed time, score and distance; yard line 1..99, goal line first) the best
option follows the football shape  go -> FG -> go -> punt  or a part of it: go near the
goal line, kick in FG range, go again in the no-man's land past easy FG range, punt deep.
Flat punt bands used to flip the advice back and forth (4th & 1 tied: go, punt, go, punt)
and FG make-rate steps did the same between go and FG.

* go vs punt alone changes at most twice per row (the H8 rule, QA 2026-10-26 23:15).
* across all three options a row changes at most 3 times and never leaves that order.

A change only counts when the new option beats the one currently shown by more than
TIE_PTS; inside that band the two are a dead heat (the UI calls < 2 pts a close call).
"""
from __future__ import annotations

import json

from nfl_sim.products import grid as g
from nfl_sim.products.meta import PRODUCTS_DIR

MAX_BEST_CHANGES_PER_ROW = 2
TIE_PTS = 0.5
GO, FG, PUNT = 0, 1, 2
SHAPE = (GO, FG, GO, PUNT)
MAX_FG_STEP_PTS = 2.0  # FG value may move at most this much per yard (was 9.1 before M12)


def _doc():
    return json.loads((PRODUCTS_DIR / "fourth_down" / "grid.json").read_text())


def _rows(doc=None):
    doc = doc or _doc()
    for t in range(len(g.TIMES)):
        for s in range(len(g.SCORE)):
            for d in range(len(g.DIST)):
                row = [doc["cells"][g.cell_index(t, s, d, yl)] for yl in range(1, 100)]
                yield (t, s, d), row, doc["scale"]


def best_sequence(row, scale, options=(GO, FG, PUNT), tie_pts=TIE_PTS) -> list[int]:
    seq: list[int] = []
    for c in row:
        if c is None:
            continue
        vals = {i: c[i] for i in options if c[i] is not None}
        if not vals:
            continue
        top = max(vals, key=vals.get)
        if not seq:
            seq.append(top)
        elif seq[-1] not in vals or (top != seq[-1] and vals[top] - vals[seq[-1]] > tie_pts / 100 * scale):
            if top != seq[-1]:
                seq.append(top)
    return seq


def _follows_shape(seq) -> bool:
    it = iter(SHAPE)
    return all(any(x == y for y in it) for x in seq)


def test_go_vs_punt_changes_at_most_twice_per_row():
    bad = [(k, s) for k, row, sc in _rows() if len(s := best_sequence(row, sc, (GO, PUNT))) - 1 > MAX_BEST_CHANGES_PER_ROW]
    assert not bad, f"{len(bad)} rows: {bad[:10]}"


def test_best_choice_follows_go_fg_go_punt_shape():
    bad = [(k, s) for k, row, sc in _rows() if not _follows_shape(s := best_sequence(row, sc))]
    assert not bad, f"{len(bad)} rows break go>FG>go>punt: {bad[:10]}"


def test_fg_value_moves_smoothly_by_yard():
    worst: tuple = (0.0, ())
    for k, row, sc in _rows():
        for yl, (a, b) in enumerate(zip(row, row[1:]), start=1):
            if a and b and a[FG] is not None and b[FG] is not None:
                step = abs(a[FG] - b[FG]) / sc * 100
                worst = max(worst, (step, (k, yl)))
    assert worst[0] <= MAX_FG_STEP_PTS, worst


def test_counter_sees_the_old_flip_pattern():
    flip = [[5000, None, 4000], [4000, None, 5000], [5000, None, 4000], [4000, None, 5000]]
    assert best_sequence(flip, 10000) == [GO, PUNT, GO, PUNT] and not _follows_shape([GO, PUNT, GO, PUNT])
    assert best_sequence([[5000, None, 4990], [4990, None, 5000]], 10000) == [GO]  # dead heat
    assert _follows_shape([GO, FG, GO, PUNT]) and _follows_shape([FG, PUNT])
    assert not _follows_shape([GO, FG, GO, FG, GO])
