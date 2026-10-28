"""builtAt / dataThrough for data/site/*.json (QA Q8, 2026-10-28).

dataThrough: date of the last nflverse game in the input (what "builtAt" used to hold).
builtAt:     date the file's content was last built. Deterministic: when a rebuild's content
             (everything except builtAt) equals the committed file, the committed builtAt is kept,
             so re-running a builder is a no-op. Otherwise SOURCE_DATE_EPOCH (if set) or today's
             UTC date. builtAt is never part of any frozen-data check.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any


def build_date() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    t = datetime.fromtimestamp(int(epoch), timezone.utc) if epoch else datetime.now(timezone.utc)
    return t.strftime("%Y-%m-%d")


def stamp(new: dict[str, Any], old: dict[str, Any] | None) -> dict[str, Any]:
    body = {k: v for k, v in new.items() if k != "builtAt"}
    if old and {k: v for k, v in old.items() if k != "builtAt"} == body and old.get("builtAt"):
        built = old["builtAt"]
    else:
        built = build_date()
    out: dict[str, Any] = {}
    for k, v in new.items():  # keep key order; builtAt sits where it was
        out[k] = built if k == "builtAt" else v
    if "builtAt" not in out:
        out["builtAt"] = built
    return out
