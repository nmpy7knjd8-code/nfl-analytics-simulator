"""Situation Lab — offline read-only UI + API over decision-lab compare_transitions.

Separate from the fan-facing Next.js UI. Reuses compare_transition_modes; no
duplicated go/FG/punt scoring logic. Trusted WP artifact path only.

Pre-snap fixture/demo path shares the same payload shape; never claims a live feed.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, HTMLResponse

from nfl_sim.config import REPO_ROOT

WP_MODEL_ARTIFACT = REPO_ROOT / "reports" / "wp" / "artifacts" / "wp_model.joblib"
STATIC_HTML = Path(__file__).resolve().parent / "static" / "situation_lab.html"

PRE_SNAP_DISCLAIMER = (
    "Offline estimate from a pre-snap snapshot fixture — not a live feed, "
    "not live odds or betting advice. Path A uncalibrated WP + REG train empirics only."
)

# Documented flip is default; anchor included for contrast.
PRESETS: list[dict[str, Any]] = [
    {
        "id": "flip-lac-den",
        "label": "Flip: LAC@DEN 2022 W18 — 4th & 14 (inconclusive → punt)",
        "season": 2022,
        "game_id": "2022_18_LAC_DEN",
        "play_id": 3897,
        "note": "Documented legacy→improved recommendation flip",
        "default": True,
    },
    {
        "id": "anchor-bal-nyj",
        "label": "Anchor: BAL@NYJ 2022 W1 — 4th & 1 (rec stable)",
        "season": 2022,
        "game_id": "2022_01_BAL_NYJ",
        "play_id": 368,
        "note": "Early-game anchor; values barely move",
        "default": False,
    },
]


@lru_cache(maxsize=1)
def _load_analyzer():
    from nfl_sim.models.decision_lab import load_analyzer

    if not WP_MODEL_ARTIFACT.exists():
        return None
    return load_analyzer(WP_MODEL_ARTIFACT)


def _summarize_config(block: dict[str, Any]) -> dict[str, Any]:
    summary = block.get("summary") or {}
    analysis = block.get("analysis") or {}
    actions = analysis.get("actions") or {}
    assumptions = analysis.get("assumptions") or []
    punt = (actions.get("punt") or {}).get("components") or {}
    return {
        "recommendation": summary.get("recommendation"),
        "inconclusive": summary.get("inconclusive"),
        "margin": summary.get("margin"),
        "values": summary.get("values"),
        "p_convert": summary.get("p_convert"),
        "p_make": summary.get("p_make"),
        "empirics_mode": summary.get("empirics_mode"),
        "transition_mode": summary.get("transition_mode"),
        "clock_deltas_used": summary.get("clock_deltas_used"),
        "empirics_seasons": summary.get("empirics_seasons"),
        "empirics_n": summary.get("empirics_n"),
        "assumptions": assumptions,
        "punt_method": punt.get("method"),
        "punt_buckets": punt.get("buckets"),
        "opp_yardline_100_mean": punt.get("opp_yardline_100_mean", punt.get("opp_yardline_100")),
    }


def _payload_from_compare(cmp: dict[str, Any], *, truth_play: str, disclaimer: str) -> dict[str, Any]:
    play = dict(cmp["play"])
    play["truth"] = truth_play
    return {
        "truth_labels": {
            "play": truth_play,
            "action_values": "model_counterfactual",
            "disclaimer": disclaimer,
        },
        "play": play,
        "configs": {
            "pooled_legacy": _summarize_config(cmp["pooled_legacy"]),
            "season_aware_legacy": _summarize_config(cmp["season_aware_legacy"]),
            "pooled_improved": _summarize_config(cmp["pooled_improved"]),
        },
        "recommendation_changed_legacy_to_improved": cmp[
            "recommendation_changed_legacy_to_improved"
        ],
        "value_deltas_legacy_to_improved": cmp["value_deltas_legacy_to_improved"],
        "clock_deltas_improved": cmp.get("clock_deltas_improved"),
        "wp_model": str(WP_MODEL_ARTIFACT),
        "offline": True,
        "live_feed": False,
    }


def build_situation_lab_payload(
    *,
    season: int,
    game_id: str,
    play_id: float,
) -> dict[str, Any]:
    """Freeze a lake play and run compare_transition_modes (reuse harness)."""
    from nfl_sim.models.decision_lab import (
        compare_transition_modes,
        load_fourth_down_frame,
        select_play,
    )

    analyzer = _load_analyzer()
    if analyzer is None:
        raise FileNotFoundError(
            f"Missing WP artifact: {WP_MODEL_ARTIFACT}. "
            "Train Path A WP first (uncalibrated primary; do not persist isotonic as default)."
        )
    frame = load_fourth_down_frame([int(season)], season_type="REG")
    row = select_play(frame, game_id=str(game_id), play_id=float(play_id))
    cmp = compare_transition_modes(analyzer, row, empirics_mode="pooled")
    return _payload_from_compare(
        cmp,
        truth_play="historical",
        disclaimer=(
            "Offline estimate — not live odds or betting advice. "
            "Path A uncalibrated WP + REG train empirics only."
        ),
    )


def build_situation_lab_payload_from_snapshot(
    raw: dict[str, Any],
) -> dict[str, Any]:
    """Validate pre-snap snapshot → same Situation Lab payload shape (fixture/demo).

    Never opens the lake to fill fields. Never claims live_feed.
    """
    from nfl_sim.models.decision_lab import compare_transition_modes
    from nfl_sim.providers.pre_snap import (
        PreSnapAdapterError,
        parse_pre_snap_snapshot,
        snapshot_to_decision_row,
        source_dict,
    )

    analyzer = _load_analyzer()
    if analyzer is None:
        raise FileNotFoundError(
            f"Missing WP artifact: {WP_MODEL_ARTIFACT}. "
            "Train Path A WP first (uncalibrated primary; do not persist isotonic as default)."
        )
    try:
        snap = parse_pre_snap_snapshot(raw)
        row = snapshot_to_decision_row(snap)
    except PreSnapAdapterError:
        raise
    cmp = compare_transition_modes(analyzer, row, empirics_mode="pooled")
    payload = _payload_from_compare(
        cmp,
        truth_play="pre_snap_fixture",
        disclaimer=PRE_SNAP_DISCLAIMER,
    )
    payload["source"] = source_dict(snap)
    return payload


def create_situation_lab_router() -> APIRouter:
    router = APIRouter(tags=["situation-lab"])

    @router.get("/situation-lab", response_class=HTMLResponse)
    def situation_lab_page() -> FileResponse:
        if not STATIC_HTML.exists():
            raise HTTPException(status_code=500, detail="Situation Lab HTML missing")
        return FileResponse(STATIC_HTML, media_type="text/html; charset=utf-8")

    @router.get("/situation-lab/api/presets")
    def presets() -> dict[str, Any]:
        return {
            "items": PRESETS,
            "default_id": next(p["id"] for p in PRESETS if p.get("default")),
            "scope": "offline_read_only",
            "fan_ui": False,
        }

    @router.get("/situation-lab/api/compare")
    def compare(
        season: int = Query(default=2022, ge=2019, le=2022),
        game_id: str = Query(...),
        play_id: float = Query(...),
    ) -> dict[str, Any]:
        try:
            return build_situation_lab_payload(
                season=season, game_id=game_id, play_id=play_id
            )
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except (ValueError, IndexError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"situation lab compare failed: {exc}"
            ) from exc

    @router.get("/situation-lab/api/fixtures")
    def pre_snap_fixtures() -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import list_fixtures

        return {
            "items": list_fixtures(),
            "scope": "offline_pre_snap_fixture",
            "live_feed": False,
            "fan_ui": False,
        }

    @router.get("/situation-lab/api/compare-pre-snap")
    def compare_pre_snap_fixture(
        fixture_id: str = Query(..., min_length=1),
    ) -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import PreSnapAdapterError, load_fixture

        try:
            raw = load_fixture(fixture_id)
            return build_situation_lab_payload_from_snapshot(raw)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"pre-snap compare failed: {exc}"
            ) from exc

    @router.post("/situation-lab/api/compare-pre-snap")
    def compare_pre_snap_body(body: dict[str, Any]) -> dict[str, Any]:
        from nfl_sim.providers.pre_snap import PreSnapAdapterError

        try:
            return build_situation_lab_payload_from_snapshot(body)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except PreSnapAdapterError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(
                status_code=500, detail=f"pre-snap compare failed: {exc}"
            ) from exc

    return router
