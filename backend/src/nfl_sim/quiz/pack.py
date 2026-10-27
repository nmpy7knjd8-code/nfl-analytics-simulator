"""Curated offline quiz pack — situations baked from freeze + compare path."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from nfl_sim.api.situation_lab import (
    build_situation_lab_payload,
    layman_why_from_config,
)

QUIZ_PACK_PATH = Path(__file__).resolve().parent / "data" / "curated_pack.json"

# Historical refs used when regenerating from lake + WP (optional).
HISTORICAL_REFS: list[dict[str, Any]] = [
    {
        "id": "flip-lac-den",
        "season": 2022,
        "game_id": "2022_18_LAC_DEN",
        "play_id": 3897.0,
        "label": "LAC @ DEN — 4th & 14",
        "note": "Late 4th & 14 from own 36; FG out of range (81 yd)",
    },
    {
        "id": "anchor-bal-nyj",
        "season": 2022,
        "game_id": "2022_01_BAL_NYJ",
        "play_id": 368.0,
        "label": "BAL @ NYJ — 4th & 1 early",
        "note": "Decision-lab anchor",
    },
]


@lru_cache(maxsize=1)
def load_curated_pack() -> dict[str, Any]:
    if not QUIZ_PACK_PATH.exists():
        raise FileNotFoundError(f"Quiz pack missing: {QUIZ_PACK_PATH}")
    data = json.loads(QUIZ_PACK_PATH.read_text(encoding="utf-8"))
    items = data.get("items") or []
    if len(items) < 5:
        raise ValueError(f"Quiz pack must include ≥5 situations, got {len(items)}")
    return data


def situation_public_view(item: dict[str, Any]) -> dict[str, Any]:
    """Situation card without model reveal (hide until lock-in)."""
    return {
        "id": item["id"],
        "label": item.get("label"),
        "kind": item.get("kind"),
        "source": item.get("source"),
        "situation": item["situation"],
        "historical_action": item.get("historical_action"),
        # Explicitly omit reveal
    }


def public_pack(pack: dict[str, Any] | None = None) -> dict[str, Any]:
    """Pack listing for clients that must not show model values until lock-in."""
    data = pack or load_curated_pack()
    return {
        "schema_version": data.get("schema_version"),
        "offline": True,
        "live_feed": False,
        "count": len(data.get("items") or []),
        "items": [situation_public_view(it) for it in data["items"]],
    }


def get_pack_item(item_id: str, pack: dict[str, Any] | None = None) -> dict[str, Any]:
    data = pack or load_curated_pack()
    for it in data["items"]:
        if it["id"] == item_id:
            return it
    raise KeyError(f"Unknown quiz situation id: {item_id}")


def reveal_for_item(item: dict[str, Any]) -> dict[str, Any]:
    reveal = dict(item.get("reveal") or {})
    reveal.setdefault("historical_action", item.get("historical_action"))
    return reveal


def pack_item_from_situation_lab_payload(
    *,
    item_id: str,
    label: str,
    payload: dict[str, Any],
    note: str = "",
) -> dict[str, Any]:
    """Project a Situation Lab compare payload into quiz pack shape.

    Primary reveal config: ``pooled_improved`` (same as Lab layman_why).
    """
    play = payload["play"]
    prov = play.get("provenance") or {}
    sit = play.get("situation") or {}
    gs = play.get("game_state") or {}
    cfg = (payload.get("configs") or {}).get("pooled_improved") or {}
    why = payload.get("layman_why") or layman_why_from_config(cfg)

    posteam = prov.get("posteam") or sit.get("posteam")
    defteam = prov.get("defteam") or sit.get("defteam")
    sd = int(sit.get("score_differential", gs.get("score_differential") or 0))
    # Real scores only. The pack builder overwrites these from the play row; we never
    # invent a "neutral board" (that produced fake scoreboards fans could spot).
    posteam_score = sit.get("posteam_score", prov.get("posteam_score"))
    defteam_score = sit.get("defteam_score", prov.get("defteam_score"))
    if posteam_score is None or defteam_score is None:
        posteam_score = defteam_score = -1  # sentinel; build_quiz_pack.py always replaces it

    return {
        "id": item_id,
        "label": label,
        "kind": "historical",
        "source": {
            "season": prov.get("season") or sit.get("season"),
            "game_id": prov.get("game_id"),
            "play_id": prov.get("play_id"),
            "note": note,
        },
        "situation": {
            "posteam": posteam,
            "defteam": defteam,
            "home_team": prov.get("home_team"),
            "away_team": prov.get("away_team"),
            "posteam_score": int(posteam_score),
            "defteam_score": int(defteam_score),
            "score_differential": sd,
            "qtr": int(sit.get("qtr") or gs.get("qtr") or 4),
            "game_seconds_remaining": int(
                sit.get("game_seconds_remaining") or gs.get("game_seconds_remaining") or 0
            ),
            "half_seconds_remaining": int(
                sit.get("half_seconds_remaining") or gs.get("half_seconds_remaining") or 0
            ),
            "yardline_100": int(sit.get("yardline_100") or gs.get("yardline_100") or 50),
            "down": 4,
            "distance": int(sit.get("distance") or gs.get("distance") or 1),
            "posteam_timeouts": int(sit.get("posteam_timeouts") or 0),
            "defteam_timeouts": int(sit.get("defteam_timeouts") or 0),
        },
        "historical_action": play.get("historical_action"),
        "reveal": {
            "recommendation": cfg.get("recommendation"),
            "inconclusive": bool(cfg.get("inconclusive")),
            "margin": cfg.get("margin"),
            "values": cfg.get("values") or {},
            "layman_why": why,
            "transition_mode": cfg.get("transition_mode") or "improved",
            "empirics_mode": cfg.get("empirics_mode") or "pooled",
            "assumptions": list(cfg.get("assumptions") or []),
            "recommendation_changed_legacy_to_improved": payload.get(
                "recommendation_changed_legacy_to_improved"
            ),
        },
    }


def materialize_historical_item(ref: dict[str, Any]) -> dict[str, Any]:
    """Freeze lake play + compare_transition_modes → quiz item (needs lake + WP)."""
    payload = build_situation_lab_payload(
        season=int(ref["season"]),
        game_id=str(ref["game_id"]),
        play_id=float(ref["play_id"]),
    )
    return pack_item_from_situation_lab_payload(
        item_id=str(ref["id"]),
        label=str(ref.get("label") or ref["id"]),
        payload=payload,
        note=str(ref.get("note") or ""),
    )


# --- Fan-facing text (QA2 H3) -------------------------------------------------------
# Displayed fields (layman_why, assumptions) must be plain fan language. Model details
# (edge in WP units, engine assumptions) move to non-displayed fields edge_wp / model_notes.
_FAN_LABELS = {"go": "Going for it", "fg": "Kicking the field goal", "punt": "Punting"}
_FAN_SHORT = {"go": "going for it", "fg": "a field goal", "punt": "punting"}
FAN_ASSUMPTIONS = [
    "Win chances come from a model trained on real NFL games (2019–2021 regular seasons).",
    "Field goal distance is the line of scrimmage plus 18 yards; no kicks over 64 yards.",
    "A failed 4th down or missed kick hands the opponent the ball at that spot.",
    "Punts use where real punts from this spot usually ended up.",
    "The clock runs about as long as it really did after each kind of play.",
]
BANNED_DISPLAY_TERMS = ("WP", "edge ≈", "isotonic", "yardline_100")


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def fan_why(reveal: dict[str, Any]) -> str:
    values = {k: float(v) for k, v in (reveal.get("values") or {}).items()}
    rec = reveal.get("recommendation")
    if not values:
        return "Not enough data to judge this call."
    ranked = sorted(values.items(), key=lambda kv: kv[1], reverse=True)
    if reveal.get("inconclusive") or rec not in values or len(ranked) < 2:
        names = [_FAN_SHORT[k] for k in ("fg", "go", "punt") if k in values]
        opts = names[0] if len(names) == 1 else (
            f"{names[0]} and {names[1]}" if len(names) == 2 else ", ".join(names[:-1]) + f", and {names[-1]}"
        )
        return f"Close call: {opts} give about the same win chance (around {_pct(ranked[0][1])})."
    best = values[rec]
    runner = max(v for k, v in values.items() if k != rec)
    gain = max(best - runner, 0.0)
    gain_txt = "less than 1%" if gain < 0.005 else f"about {_pct(gain)}"
    return (
        f"{_FAN_LABELS[rec]} added {gain_txt} win chance over the next-best option "
        f"({best * 100:.1f}% vs {runner * 100:.1f}%)."
    )


def fanify_reveal(reveal: dict[str, Any]) -> dict[str, Any]:
    """Idempotent: rewrite displayed text in fan language, keep model details hidden."""
    if "model_notes" not in reveal:
        reveal["model_notes"] = list(reveal.get("assumptions") or [])
    m = reveal.get("margin")
    reveal["edge_wp"] = None if m is None else float(m)
    reveal["layman_why"] = fan_why(reveal)
    reveal["assumptions"] = list(FAN_ASSUMPTIONS)
    return reveal
