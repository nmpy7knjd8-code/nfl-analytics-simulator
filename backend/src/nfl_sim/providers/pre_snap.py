"""Thin pre-snap adapter: validated snapshot → lake-shaped row for decision lab.

Fixture/demo only. Never claims a live feed. Never fills missing fields from
the historical lake. Auto fields from snapshot; allowlisted user_fallback only
when the feed omits time/down/field position.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from nfl_sim.contracts.pre_snap import (
    AUTO_SITUATION_FIELDS,
    OPTIONAL_SITUATION_FIELDS,
    USER_FALLBACK_FIELDS,
    Freshness,
    PreSnapSnapshot,
    PreSnapSituation,
    PreSnapSource,
    UserFallback,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "pre_snap"

SCHEMA_VERSION = "pre_snap_snapshot.v1"

# Bundled fixtures (id → filename stem). Self-contained JSON only.
FIXTURE_REGISTRY: dict[str, dict[str, str]] = {
    "flip-lac-den-pre-snap": {
        "file": "flip_lac_den_pre_snap.json",
        "label": "Fixture: LAC@DEN 2022 W18 — 4th & 14 (pre-snap flip state)",
        "note": "Mirrors documented Situation Lab flip pre-snap state; not a live feed",
    },
}


class PreSnapAdapterError(ValueError):
    """Clear, named validation / freshness / unsupported-state rejection."""


def _present(value: Any) -> bool:
    return value is not None and value != ""


def merge_situation_with_fallback(
    situation_raw: dict[str, Any] | None,
    user_fallback_raw: dict[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, str]]:
    """Merge feed situation + optional user_fallback.

    Auto fields must come from situation (unsupported-state if missing).
    User-fallback allowlist only when situation omits them.
    Conflict (both set) → reject. Never invent defaults.
    """
    if not isinstance(situation_raw, dict):
        raise PreSnapAdapterError("situation: required object (unsupported-state)")

    try:
        fallback = UserFallback.model_validate(user_fallback_raw or {})
    except ValidationError as exc:
        err = exc.errors()[0]
        loc = ".".join(str(x) for x in err.get("loc", ()))
        msg = err.get("msg", "validation failed")
        raise PreSnapAdapterError(
            f"user_fallback.{loc}: {msg}" if loc else f"user_fallback: {msg}"
        ) from exc

    provided_fb = fallback.provided()
    # Reject unknown keys already handled by extra=forbid on UserFallback.
    # Also reject if caller stuffed auto-only keys into a plain dict before parse —
    # UserFallback forbids extras. Good.

    merged: dict[str, Any] = {}
    sources: dict[str, str] = {}

    for key in AUTO_SITUATION_FIELDS:
        if key not in situation_raw or not _present(situation_raw.get(key)):
            raise PreSnapAdapterError(
                f"unsupported-state: auto field {key!r} missing from snapshot "
                "(not user-fallbackable; never silently invented)"
            )
        if key in (user_fallback_raw or {}):
            raise PreSnapAdapterError(
                f"user_fallback.{key}: not allowlisted (auto-from-feed only)"
            )
        merged[key] = situation_raw[key]
        sources[key] = "snapshot"

    for key in USER_FALLBACK_FIELDS:
        sit_has = key in situation_raw and _present(situation_raw.get(key))
        fb_has = key in provided_fb
        if sit_has and fb_has:
            raise PreSnapAdapterError(
                f"conflict: {key!r} present in both situation and user_fallback"
            )
        if sit_has:
            merged[key] = situation_raw[key]
            sources[key] = "snapshot"
        elif fb_has:
            merged[key] = provided_fb[key]
            sources[key] = "user_fallback"
        else:
            raise PreSnapAdapterError(
                f"unsupported-state: {key!r} missing from snapshot; "
                "supply user_fallback or a complete feed (never silently invented)"
            )

    for key in OPTIONAL_SITUATION_FIELDS:
        if key in situation_raw and _present(situation_raw.get(key)):
            merged[key] = situation_raw[key]
            sources[key] = "snapshot"

    # Reject unknown situation keys (keep contract tight).
    allowed = AUTO_SITUATION_FIELDS | USER_FALLBACK_FIELDS | OPTIONAL_SITUATION_FIELDS
    unknown = set(situation_raw) - allowed
    if unknown:
        raise PreSnapAdapterError(
            f"situation: unknown fields {sorted(unknown)} (extra=forbid)"
        )

    return merged, sources


def parse_pre_snap_snapshot(raw: dict[str, Any] | PreSnapSnapshot) -> PreSnapSnapshot:
    """Parse + validate + merge user_fallback. Missing ≠ zero-filled."""
    if isinstance(raw, PreSnapSnapshot):
        return raw
    if not isinstance(raw, dict):
        raise PreSnapAdapterError("snapshot must be a JSON object")

    schema = raw.get("schema_version")
    if schema != SCHEMA_VERSION:
        raise PreSnapAdapterError(
            f"schema_version: unsupported {schema!r}; expected {SCHEMA_VERSION!r}"
        )
    if "source" not in raw:
        raise PreSnapAdapterError("source: required (unsupported-state)")
    if "situation" not in raw:
        raise PreSnapAdapterError("situation: required (unsupported-state)")

    try:
        source = PreSnapSource.model_validate(raw["source"])
    except ValidationError as exc:
        err = exc.errors()[0]
        loc = ".".join(str(x) for x in err.get("loc", ()))
        msg = err.get("msg", "validation failed")
        raise PreSnapAdapterError(f"source.{loc}: {msg}" if loc else f"source: {msg}") from exc

    merged_sit, field_sources = merge_situation_with_fallback(
        raw.get("situation"),
        raw.get("user_fallback"),
    )
    try:
        situation = PreSnapSituation.model_validate(merged_sit)
    except ValidationError as exc:
        err = exc.errors()[0]
        loc = ".".join(str(x) for x in err.get("loc", ()))
        msg = err.get("msg", "validation failed")
        raise PreSnapAdapterError(f"{loc}: {msg}" if loc else msg) from exc

    return PreSnapSnapshot(
        schema_version=SCHEMA_VERSION,
        source=source,
        situation=situation,
        field_sources=field_sources,
    )


def assert_scorable(snapshot: PreSnapSnapshot) -> None:
    """Only freshness=pre_snap may enter Situation Lab scoring."""
    fresh = snapshot.source.freshness
    if fresh is Freshness.IN_PLAY:
        raise PreSnapAdapterError(
            "freshness=in_play: snapshot is not decision-ready; refuse to score"
        )
    if fresh is Freshness.STALE:
        raise PreSnapAdapterError(
            "freshness=stale: snapshot is stale; refuse to score (stale ≠ simulated)"
        )
    if fresh is not Freshness.PRE_SNAP:
        raise PreSnapAdapterError(f"unsupported freshness {fresh!r}")


def snapshot_to_decision_row(snapshot: PreSnapSnapshot | dict[str, Any]) -> dict[str, Any]:
    """Map validated snapshot → dict consumable by freeze_play / compare_transition_modes.

    Does not open the lake. Does not invent play_type / outcomes.
    """
    snap = parse_pre_snap_snapshot(snapshot)
    assert_scorable(snap)
    sit = snap.situation
    posteam = sit.possession_team_id
    home = sit.home_team_id
    return {
        "season": int(sit.season),
        "season_type": str(sit.season_type),
        "week": int(sit.week),
        "game_id": str(sit.game_id),
        "play_id": float(sit.play_id),
        "posteam": posteam,
        "defteam": sit.defense_team_id,
        "home_team": home,
        "away_team": sit.away_team_id,
        "down": 4,
        "ydstogo": int(sit.distance),
        "yardline_100": int(sit.yardline_100),
        "score_differential": int(sit.score_differential),
        "game_seconds_remaining": int(sit.game_seconds_remaining),
        "half_seconds_remaining": int(sit.half_seconds_remaining),
        "qtr": int(sit.quarter),
        "posteam_timeouts_remaining": int(sit.posteam_timeouts),
        "defteam_timeouts_remaining": int(sit.defteam_timeouts),
        "posteam_score": int(sit.posteam_score),
        "defteam_score": int(sit.defteam_score),
        "receive_2h_ko": int(sit.receive_2h_ko),
        # Pre-snap: no observed play outcome — never silently filled from lake.
        "play_type": None,
        "desc": None,
    }


def source_dict(snapshot: PreSnapSnapshot) -> dict[str, Any]:
    src = snapshot.source
    ts = src.event_timestamp
    if ts.tzinfo is None:
        iso = ts.isoformat() + "Z"
    else:
        iso = ts.isoformat().replace("+00:00", "Z")
    return {
        "source_id": src.source_id,
        "provider": src.provider.value,
        "snapshot_id": src.snapshot_id,
        "event_timestamp": iso,
        "revision": int(src.revision),
        "freshness": src.freshness.value,
    }


def list_fixtures() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for fid, meta in FIXTURE_REGISTRY.items():
        path = FIXTURES_DIR / meta["file"]
        items.append(
            {
                "id": fid,
                "label": meta["label"],
                "note": meta["note"],
                "available": path.is_file(),
                "provider": "fixture",
                "live_feed": False,
            }
        )
    return items


def load_fixture(fixture_id: str) -> dict[str, Any]:
    if fixture_id not in FIXTURE_REGISTRY:
        raise KeyError(f"Unknown pre-snap fixture_id={fixture_id!r}")
    path = FIXTURES_DIR / FIXTURE_REGISTRY[fixture_id]["file"]
    if not path.is_file():
        raise FileNotFoundError(f"Missing pre-snap fixture file: {path}")
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        raise PreSnapAdapterError(f"fixture {fixture_id!r} root must be a JSON object")
    # Ensure parseable before returning.
    parse_pre_snap_snapshot(raw)
    return raw
