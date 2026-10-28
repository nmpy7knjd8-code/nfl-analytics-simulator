"""Shared frozen-record guard for site JSON builders (B1/B2)."""
from __future__ import annotations

from typing import Any, Callable


def check_frozen(old: dict[str, Any] | None, new: dict[str, Any], key: Callable[[dict], tuple],
                 records: str = "plays", summary: tuple[str, ...] = ()) -> list[str]:
    """Every published record must survive unchanged; summary fields must not change while the
    season list is the same. Returns human-readable reasons (empty = OK)."""
    if not old:
        return []
    cols = old.get("cols")
    def rows(f):  # records may be dicts or arrays under "cols"
        return [dict(zip(f["cols"], r)) if cols else r for r in f.get(records, [])]
    newrows = {key(r): r for r in rows(new)}
    bad = [f"changed/removed {key(r)}" for r in rows(old) if newrows.get(key(r)) != r]
    if old.get("season_list") == new.get("season_list"):
        bad += [f"summary {k}" for k in summary if old.get(k) != new.get(k)]
    if cols and cols != new.get("cols"):
        bad.append("cols")
    return bad
