"""Offline provider-frame → pre_snap_snapshot.v1 mapper (fixture/demo only).

No HTTP, no live feed, no Path A derive, no unknown-enum coercion.
Yardline: signed-off Y1–Y15 convention. receive_2h_ko: fail_closed.v1.
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from nfl_sim.providers.pre_snap import (
    PreSnapAdapterError,
    parse_pre_snap_snapshot,
)

FRAMES_DIR = Path(__file__).resolve().parent / "fixtures" / "offline_mapper"

OFFLINE_SCHEMA = "offline_provider_frame.v1"
SNAPSHOT_SCHEMA = "pre_snap_snapshot.v1"

# Explicit seed aliases after alias.normalize.v1 (clarifications §2.1).
# Game-scoped mapping still requires alias ∈ {home, away} for the frame.
KNOWN_ALIAS_IDS: frozenset[str] = frozenset({"KC", "DEN", "LAC", "BAL"})

SEASON_TYPE_MAP: dict[str, str] = {
    "REG": "REG",
    "POST": "POST",
    "PRE": "PRE",
}

# Bundled offline frames (id → meta). Self-contained JSON only — no network.
FRAME_REGISTRY: dict[str, dict[str, str]] = {
    "kc-den-q4-own-25": {
        "file": "kc_den_q4_own_25.json",
        "label": "Offline mapper: KC@DEN — KC ball own 25 (4th)",
        "note": "Y1-style own territory; receive_2h_ko present; not a live feed",
    },
    "kc-den-q4-opp-25": {
        "file": "kc_den_q4_opp_25.json",
        "label": "Offline mapper: KC@DEN — KC ball opp 25 (4th)",
        "note": "Y2-style opponent territory; frame update from own-25",
    },
    "kc-den-stale": {
        "file": "kc_den_stale.json",
        "label": "Offline mapper: KC@DEN — stale freshness (reject)",
        "note": "Must reject; no prior decision reuse",
    },
    "kc-den-bad-score": {
        "file": "kc_den_bad_score.json",
        "label": "Offline mapper: KC@DEN — inconsistent score (reject)",
        "note": "score_differential mismatch",
    },
}


class OfflineMapperError(PreSnapAdapterError):
    """Structured validation failure from offline mapper (HTTP 400)."""


def alias_normalize(raw_alias: Any) -> str:
    """RULE alias.normalize.v1 — copy-ready from clarifications."""
    if raw_alias is None:
        raise OfflineMapperError("alias_missing: raw_alias is null")
    if not isinstance(raw_alias, str):
        raise OfflineMapperError(
            f"alias_missing: raw_alias must be str (got {type(raw_alias).__name__})"
        )
    s = raw_alias.strip()
    if not s:
        raise OfflineMapperError("alias_missing: empty after trim")
    s = s.upper()
    if not re.fullmatch(r"[A-Z0-9]+", s):
        raise OfflineMapperError(
            f"alias_charset_invalid: {raw_alias!r} (no spaces/nicknames/fuzzy)"
        )
    return s


def alias_to_team_id(
    normalized_alias: str,
    home_alias_norm: str,
    away_alias_norm: str,
    home_team_id: str,
    away_team_id: str,
) -> str:
    """RULE alias.to_team_id.v1 — game-scoped; reject not-in-game / unmapped."""
    if normalized_alias == home_alias_norm:
        return home_team_id
    if normalized_alias == away_alias_norm:
        return away_team_id
    raise OfflineMapperError(
        f"alias_not_in_game: {normalized_alias!r} not in "
        f"{{{home_alias_norm}, {away_alias_norm}}}"
    )


def yardline_100_from_sr(
    possession_alias: Any,
    location_alias: Any,
    location_yardline: Any,
    home_alias: Any,
    away_alias: Any,
) -> int:
    """Signed-off Y1–Y15 transform (blocker resolution §3 / clarifications §4.1)."""
    home_n = alias_normalize(home_alias)
    away_n = alias_normalize(away_alias)
    if home_n == away_n:
        raise OfflineMapperError("game: home_alias and away_alias must differ")
    # POC: team_id == normalized market alias
    home_id, away_id = home_n, away_n
    poss = alias_to_team_id(
        alias_normalize(possession_alias), home_n, away_n, home_id, away_id
    )
    if location_alias is None or (
        isinstance(location_alias, str) and not location_alias.strip()
    ):
        raise OfflineMapperError("alias_missing: location.alias")
    loc = alias_to_team_id(
        alias_normalize(location_alias), home_n, away_n, home_id, away_id
    )
    if location_yardline is None or location_yardline == "":
        raise OfflineMapperError("yardline missing: location.yardline")
    try:
        yrd = int(location_yardline)
    except (TypeError, ValueError) as exc:
        raise OfflineMapperError(
            f"yardline invalid: location.yardline={location_yardline!r}"
        ) from exc
    if loc == poss:
        y100 = 100 - yrd
    else:
        y100 = yrd
    if y100 < 1 or y100 > 99:
        raise OfflineMapperError(
            f"yardline_100 out of range: got {y100} from "
            f"(poss={poss!r}, loc_alias={location_alias!r}, yardline={yrd})"
        )
    return y100


def _map_season_type(raw: Any) -> str:
    if raw is None or raw == "":
        raise OfflineMapperError(
            "season_type_unmapped: missing (unsupported-state)"
        )
    if not isinstance(raw, str):
        raise OfflineMapperError(
            f"season_type_unmapped: expected str got {type(raw).__name__}"
        )
    key = raw.strip().upper()
    if key not in SEASON_TYPE_MAP:
        raise OfflineMapperError(
            f"season_type_unmapped: {raw!r} (POC map: REG|POST|PRE only)"
        )
    return SEASON_TYPE_MAP[key]


def _require_int(obj: dict[str, Any], key: str, *, ge: int | None = None, le: int | None = None) -> int:
    if key not in obj or obj[key] is None or obj[key] == "":
        raise OfflineMapperError(f"unsupported-state: required field {key!r} missing")
    try:
        val = int(obj[key])
    except (TypeError, ValueError) as exc:
        raise OfflineMapperError(f"{key}: invalid int {obj[key]!r}") from exc
    if ge is not None and val < ge:
        raise OfflineMapperError(f"{key}: {val} < {ge}")
    if le is not None and val > le:
        raise OfflineMapperError(f"{key}: {val} > {le}")
    return val


def _parse_clock_mmss(clock: Any) -> int:
    if not isinstance(clock, str) or not re.fullmatch(r"\d{1,2}:\d{2}", clock.strip()):
        raise OfflineMapperError(f"clock invalid: expected MM:SS got {clock!r}")
    mm, ss = clock.strip().split(":")
    minutes, seconds = int(mm), int(ss)
    if seconds >= 60:
        raise OfflineMapperError(f"clock invalid: seconds {seconds}")
    return minutes * 60 + seconds


def _clocks_from_situation(sit: dict[str, Any], quarter: int) -> tuple[int, int]:
    """Prefer explicit seconds; else clock MM:SS + quarter (1–4 half logic; OT=5)."""
    half_has = "half_seconds_remaining" in sit and sit["half_seconds_remaining"] not in (
        None,
        "",
    )
    game_has = "game_seconds_remaining" in sit and sit["game_seconds_remaining"] not in (
        None,
        "",
    )
    if half_has and game_has:
        return (
            _require_int(sit, "half_seconds_remaining", ge=0),
            _require_int(sit, "game_seconds_remaining", ge=0),
        )
    if "clock" not in sit or sit["clock"] in (None, ""):
        raise OfflineMapperError(
            "unsupported-state: need half_seconds_remaining+game_seconds_remaining "
            "or clock MM:SS"
        )
    rem = _parse_clock_mmss(sit["clock"])
    if quarter in (1, 2):
        # Seconds remaining in first half: Q1 adds full Q2 (15:00).
        half = rem + (15 * 60 if quarter == 1 else 0)
        game = half + 2 * 15 * 60
    elif quarter in (3, 4):
        half = rem + (15 * 60 if quarter == 3 else 0)
        game = half
    elif quarter == 5:
        half = rem
        game = rem
    else:
        raise OfflineMapperError(f"quarter invalid for clock: {quarter}")
    return half, game


def apply_receive_2h_ko_fail_closed(sit: dict[str, Any]) -> int:
    """RULE receive_2h_ko.fail_closed.v1 — Path A unsupported; no silent default."""
    if "receive_2h_ko" not in sit or sit["receive_2h_ko"] is None or sit["receive_2h_ko"] == "":
        raise OfflineMapperError(
            "receive_2h_ko_unavailable: fail_closed "
            "(path=fail_closed; Path A unsupported; never invent 0/1)"
        )
    try:
        bit = int(sit["receive_2h_ko"])
    except (TypeError, ValueError) as exc:
        raise OfflineMapperError(
            f"receive_2h_ko invalid: {sit['receive_2h_ko']!r}"
        ) from exc
    if bit not in (0, 1):
        raise OfflineMapperError(f"receive_2h_ko invalid: {bit} not in {{0,1}}")
    return bit


def map_offline_frame(raw: dict[str, Any]) -> dict[str, Any]:
    """Map offline_provider_frame.v1 → pre_snap_snapshot.v1 dict (validated)."""
    if not isinstance(raw, dict):
        raise OfflineMapperError("frame: required object")

    if raw.get("schema_version") != OFFLINE_SCHEMA:
        raise OfflineMapperError(
            f"unsupported schema_version {raw.get('schema_version')!r}; "
            f"expected {OFFLINE_SCHEMA!r}"
        )

    provider = raw.get("provider")
    if provider not in ("fixture", "demo"):
        raise OfflineMapperError(
            f"provider enum rejected: {provider!r} "
            "(closed set: fixture|demo; never coerce unknown)"
        )

    for key in ("source_id", "snapshot_id", "event_timestamp"):
        if key not in raw or raw[key] is None or raw[key] == "":
            raise OfflineMapperError(f"unsupported-state: {key!r} missing")

    try:
        revision = int(raw["revision"])
    except (KeyError, TypeError, ValueError) as exc:
        raise OfflineMapperError("revision: required int ≥ 1") from exc
    if revision < 1:
        raise OfflineMapperError("revision: must be ≥ 1")

    freshness = raw.get("freshness")
    if freshness not in ("pre_snap", "in_play", "stale"):
        raise OfflineMapperError(
            f"freshness enum rejected: {freshness!r} "
            "(closed: pre_snap|in_play|stale)"
        )

    game = raw.get("game")
    if not isinstance(game, dict):
        raise OfflineMapperError("game: required object")
    sit = raw.get("situation")
    if not isinstance(sit, dict):
        raise OfflineMapperError("situation: required object")

    home_alias = game.get("home_alias")
    away_alias = game.get("away_alias")
    home_n = alias_normalize(home_alias)
    away_n = alias_normalize(away_alias)
    if home_n == away_n:
        raise OfflineMapperError("game: home_alias and away_alias must differ")
    home_id, away_id = home_n, away_n

    possession_alias = sit.get("possession_alias")
    possession_id = alias_to_team_id(
        alias_normalize(possession_alias), home_n, away_n, home_id, away_id
    )
    defense_id = away_id if possession_id == home_id else home_id

    loc = sit.get("location")
    if not isinstance(loc, dict):
        raise OfflineMapperError("situation.location: required object")
    yardline_100 = yardline_100_from_sr(
        possession_alias,
        loc.get("alias"),
        loc.get("yardline"),
        home_alias,
        away_alias,
    )

    season = _require_int(game, "season", ge=1999, le=2100)
    season_type = _map_season_type(game.get("season_type"))
    week = _require_int(game, "week", ge=1)
    game_id = game.get("game_id")
    if not game_id:
        raise OfflineMapperError("unsupported-state: game_id missing")
    play_id = sit.get("play_id")
    if play_id is None or play_id == "":
        raise OfflineMapperError("unsupported-state: play_id missing")

    down = _require_int(sit, "down", ge=1, le=4)
    # Accept yfd (SR) or distance
    if "yfd" in sit and sit["yfd"] not in (None, ""):
        distance = _require_int(sit, "yfd", ge=1, le=99)
    else:
        distance = _require_int(sit, "distance", ge=1, le=99)

    quarter = _require_int(sit, "quarter", ge=1, le=5)
    half_s, game_s = _clocks_from_situation(sit, quarter)

    posteam_score = _require_int(sit, "posteam_score", ge=0)
    defteam_score = _require_int(sit, "defteam_score", ge=0)
    if "score_differential" not in sit or sit["score_differential"] in (None, ""):
        raise OfflineMapperError("unsupported-state: score_differential missing")
    try:
        score_differential = int(sit["score_differential"])
    except (TypeError, ValueError) as exc:
        raise OfflineMapperError(
            f"score_differential invalid: {sit['score_differential']!r}"
        ) from exc
    if score_differential != posteam_score - defteam_score:
        raise OfflineMapperError(
            "score_differential inconsistent with posteam_score - defteam_score "
            f"(got {score_differential}, expected {posteam_score - defteam_score})"
        )

    posteam_timeouts = _require_int(sit, "posteam_timeouts", ge=0, le=3)
    defteam_timeouts = _require_int(sit, "defteam_timeouts", ge=0, le=3)
    receive_2h_ko = apply_receive_2h_ko_fail_closed(sit)

    snapshot: dict[str, Any] = {
        "schema_version": SNAPSHOT_SCHEMA,
        "source": {
            "source_id": str(raw["source_id"]),
            "provider": provider,
            "snapshot_id": str(raw["snapshot_id"]),
            "event_timestamp": raw["event_timestamp"],
            "revision": revision,
            "freshness": freshness,
        },
        "situation": {
            "season": season,
            "season_type": season_type,
            "week": week,
            "game_id": str(game_id),
            "play_id": play_id,
            "possession_team_id": possession_id,
            "defense_team_id": defense_id,
            "home_team_id": home_id,
            "away_team_id": away_id,
            "down": down,
            "distance": distance,
            "yardline_100": yardline_100,
            "quarter": quarter,
            "half_seconds_remaining": half_s,
            "game_seconds_remaining": game_s,
            "score_differential": score_differential,
            "posteam_score": posteam_score,
            "defteam_score": defteam_score,
            "posteam_timeouts": posteam_timeouts,
            "defteam_timeouts": defteam_timeouts,
            "receive_2h_ko": receive_2h_ko,
        },
    }
    if "user_fallback" in raw and raw["user_fallback"] is not None:
        snapshot["user_fallback"] = raw["user_fallback"]

    # Validate through existing adapter contract (single payload shape).
    parse_pre_snap_snapshot(snapshot)
    return snapshot


def list_frames() -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for fid, meta in FRAME_REGISTRY.items():
        items.append(
            {
                "id": fid,
                "label": meta["label"],
                "note": meta["note"],
                "provider": "demo",
                "live_feed": False,
                "mode": "offline_mapper",
            }
        )
    return items


def load_frame(frame_id: str) -> dict[str, Any]:
    if frame_id not in FRAME_REGISTRY:
        raise KeyError(f"unknown offline mapper frame: {frame_id!r}")
    path = FRAMES_DIR / FRAME_REGISTRY[frame_id]["file"]
    if not path.is_file():
        raise FileNotFoundError(f"offline mapper frame missing: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def map_frame_id(frame_id: str) -> dict[str, Any]:
    return map_offline_frame(load_frame(frame_id))
