"""Recorded-frame demo provider — offline sequence → pre_snap adapter.

Deterministic select/advance by index. Never claims a live feed. Reuses
parse_pre_snap_snapshot / Situation Lab scoring; no duplicated decision math.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from nfl_sim.contracts.pre_snap import USER_FALLBACK_FIELDS
from nfl_sim.providers.pre_snap import PreSnapAdapterError, parse_pre_snap_snapshot

SEQUENCES_DIR = Path(__file__).resolve().parent / "fixtures" / "recorded_demo"

SEQUENCE_REGISTRY: dict[str, dict[str, str]] = {
    "lac-den-q4-demo": {
        "file": "lac_den_q4_sequence.json",
        "label": "Recorded demo: LAC@DEN 2022 W18 Q4 (offline frames)",
        "note": "Deterministic recorded frames — not a live feed",
    },
}


def list_sequences() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for sid, meta in SEQUENCE_REGISTRY.items():
        path = SEQUENCES_DIR / meta["file"]
        items.append(
            {
                "id": sid,
                "label": meta["label"],
                "note": meta["note"],
                "available": path.is_file(),
                "provider": "demo",
                "live_feed": False,
                "mode": "recorded_demo",
            }
        )
    return items


def load_sequence(sequence_id: str) -> dict[str, Any]:
    if sequence_id not in SEQUENCE_REGISTRY:
        raise KeyError(f"Unknown recorded demo sequence_id={sequence_id!r}")
    path = SEQUENCES_DIR / SEQUENCE_REGISTRY[sequence_id]["file"]
    if not path.is_file():
        raise FileNotFoundError(f"Missing recorded demo sequence file: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise PreSnapAdapterError("sequence root must be a JSON object")
    if raw.get("schema_version") != "recorded_demo_sequence.v1":
        raise PreSnapAdapterError(
            f"unsupported sequence schema_version {raw.get('schema_version')!r}"
        )
    if raw.get("live_feed") is True:
        raise PreSnapAdapterError("recorded demo must not set live_feed=true")
    frames = raw.get("frames")
    if not isinstance(frames, list) or not frames:
        raise PreSnapAdapterError("sequence.frames must be a non-empty list")
    return raw


def sequence_summary(sequence_id: str) -> dict[str, Any]:
    seq = load_sequence(sequence_id)
    frames_meta: list[dict[str, Any]] = []
    for fr in seq["frames"]:
        snap = fr.get("snapshot") or {}
        src = snap.get("source") or {}
        frames_meta.append(
            {
                "index": int(fr["index"]),
                "note": fr.get("note"),
                "expected": fr.get("expected"),
                "snapshot_id": src.get("snapshot_id"),
                "event_timestamp": src.get("event_timestamp"),
                "freshness": src.get("freshness"),
                "revision": src.get("revision"),
                "missing_allowlist": missing_allowlist_fields(snap),
                "has_suggested_user_fallback": bool(fr.get("suggested_user_fallback")),
            }
        )
    return {
        "sequence_id": seq["sequence_id"],
        "label": seq.get("label"),
        "note": seq.get("note"),
        "provider": "demo",
        "live_feed": False,
        "mode": "recorded_demo",
        "frame_count": len(frames_meta),
        "frames": frames_meta,
    }


def get_frame(sequence_id: str, index: int) -> dict[str, Any]:
    seq = load_sequence(sequence_id)
    frames = seq["frames"]
    if index < 0 or index >= len(frames):
        raise IndexError(
            f"frame index {index} out of range for sequence "
            f"{sequence_id!r} ({len(frames)} frames)"
        )
    fr = frames[index]
    if int(fr.get("index", index)) != int(index):
        # Prefer positional index; still surface mismatch clearly.
        raise PreSnapAdapterError(
            f"frame index mismatch: requested {index}, file says {fr.get('index')}"
        )
    return copy.deepcopy(fr)


def missing_allowlist_fields(snapshot: dict[str, Any]) -> list[str]:
    sit = snapshot.get("situation") or {}
    missing: list[str] = []
    for key in sorted(USER_FALLBACK_FIELDS):
        if key not in sit or sit.get(key) is None or sit.get(key) == "":
            missing.append(key)
    return missing


def prepare_snapshot_for_score(
    frame: dict[str, Any],
    user_fallback: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Return a raw pre_snap_snapshot.v1 dict ready for the existing adapter.

    Does not score. Does not reuse prior decisions. Optional user_fallback only.
    """
    snap = copy.deepcopy(frame["snapshot"])
    if not isinstance(snap, dict):
        raise PreSnapAdapterError("frame.snapshot must be an object")
    missing = missing_allowlist_fields(snap)
    fb = user_fallback
    if fb is None and missing and frame.get("suggested_user_fallback"):
        # Caller must opt in via apply_suggested=True at API layer — never auto here.
        pass
    if missing and not fb:
        raise PreSnapAdapterError(
            "unsupported-state: allowlist fields missing "
            f"{missing}; supply user_fallback (time/down/field position only)"
        )
    if fb:
        snap["user_fallback"] = fb
    # Validate envelope early so callers get clear errors before WP scoring.
    parse_pre_snap_snapshot(snap)
    return snap


def advance_index(sequence_id: str, current: int, *, delta: int = 1) -> int:
    """Deterministic next/prev index (no streaming)."""
    seq = load_sequence(sequence_id)
    n = len(seq["frames"])
    nxt = int(current) + int(delta)
    if nxt < 0 or nxt >= n:
        raise IndexError(
            f"cannot advance from {current} by {delta} "
            f"(sequence {sequence_id!r} has {n} frames)"
        )
    return nxt
