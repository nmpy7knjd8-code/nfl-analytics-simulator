"""Rebuilding the quiz pack keeps the ids of items that still qualify (dailySchedule.json pins ids)."""
from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "build_quiz_pack.py"


@pytest.fixture(scope="module")
def bq():
    spec = importlib.util.spec_from_file_location("build_quiz_pack", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:  # heavy imports unavailable
        pytest.skip(f"builder not importable: {e}")
    return mod


def test_rebuild_keeps_surviving_ids_and_updates_values(bq):
    existing = [f"g-{i}" for i in range(10)]
    gone = {"g-3", "g-7"}
    rebake = lambda iid: None if iid in gone else {"id": iid, "v": "new"}
    fresh = ({"id": f"n-{i}", "v": "new"} for i in range(100))
    items, dropped = bq.stable_select(existing, rebake, fresh, 10)
    ids = [it["id"] for it in items]
    assert ids[:8] == [i for i in existing if i not in gone]  # same ids, same order
    assert sorted(dropped) == sorted(gone)
    assert ids[8:] == ["n-0", "n-1"]  # only freed slots get new plays
    assert all(it["v"] == "new" for it in items)  # values updated in place


def test_rebuild_never_reuses_a_dropped_id_or_duplicates(bq):
    existing = ["a", "b", "c"]
    items, dropped = bq.stable_select(existing, lambda i: None if i == "b" else {"id": i},
                                      iter([{"id": "a"}, {"id": "b"}, {"id": "d"}]), 3)
    assert [it["id"] for it in items] == ["a", "c", "d"] and dropped == ["b"]
